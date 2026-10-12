import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { eq, and, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { pushTokens, userSettings } from '../db/schema';

export type PushPlatform = 'EXPO' | 'FCM' | 'WEB_PUSH';

export interface PushPayload {
  title: string;
  body: string;
  /** Extra key/value pairs delivered with the notification (deep links, ids). */
  data?: Record<string, string>;
}

interface ServiceAccountCreds {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface FcmV1ErrorEntry {
  code: number;
  message: string;
  status: string;
  details?: unknown;
}

interface FcmV1Response {
  names?: string[];
  message_ids?: string[];
  invalid_message_count?: number;
  error?: FcmV1ErrorEntry[];
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_ENDPOINT = (projectId: string) =>
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

/**
 * Device push delivery (FCM HTTP v1).
 *
 * Tokens are stored in `push_tokens` (Postgres = source of truth). Delivery
 * uses the FCM v1 REST API with an OAuth2 token minted from a service
 * account (google-auth-library — no firebase-admin dependency). When no
 * service account is configured the service degrades to a logged no-op so
 * local development works without Firebase credentials.
 *
 * Expo push tokens (platform EXPO) are delivered through the same FCM v1
 * API — Expo's FCM proxy accepts standard FCM messages.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;
  private readonly projectId: string | null;
  private readonly googleAuth: GoogleAuth | null;

  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    const creds = this.resolveServiceAccount();
    if (creds) {
      this.configured = true;
      this.projectId = creds.project_id;
      this.googleAuth = new GoogleAuth({
        credentials: {
          client_email: creds.client_email,
          private_key: creds.private_key,
          project_id: creds.project_id,
        },
        scopes: [FCM_SCOPE],
      });
    } else {
      this.configured = false;
      this.projectId = null;
      this.googleAuth = null;
      this.logger.warn(
        'No FCM service account configured (FCM_SERVICE_ACCOUNT_JSON or ' +
          'FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY) — push delivery is disabled',
      );
    }
  }

  // ── Token management ──────────────────────────────────────

  /** Register (or refresh) a device token for the user. Idempotent. */
  async registerToken(
    userId: string,
    token: string,
    platform: PushPlatform = 'EXPO',
  ): Promise<{ registered: boolean }> {
    await this.db
      .insert(pushTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId, platform, updatedAt: new Date() },
      });
    return { registered: true };
  }

  /** Remove a device token (app uninstall / token rotation). */
  async unregisterToken(
    userId: string,
    token: string,
  ): Promise<{ unregistered: boolean }> {
    await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
    return { unregistered: true };
  }

  // ── Delivery ──────────────────────────────────────────────

  /**
   * Send a push notification to one user if they have push enabled and at
   * least one registered device. Never throws — delivery failures are
   * logged, they must not break the calling business flow.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      if (!(await this.pushEnabled(userId))) {
        return;
      }
      const rows = await this.db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(eq(pushTokens.userId, userId));
      if (rows.length === 0) {
        return;
      }
      await this.deliver(
        rows.map((r) => r.token),
        payload,
      );
    } catch (error) {
      this.logger.warn(
        `Push delivery failed for user ${userId}: ${String(error)}`,
      );
    }
  }

  /** Send to many users in a single FCM batch call. Never throws. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    try {
      const enabled = await this.filterPushEnabled(userIds);
      if (enabled.length === 0) {
        return;
      }
      const rows = await this.db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(inArray(pushTokens.userId, enabled));
      await this.deliver(
        rows.map((r) => r.token),
        payload,
      );
    } catch (error) {
      this.logger.warn(`Push batch delivery failed: ${String(error)}`);
    }
  }

  // ── Internals ─────────────────────────────────────────────

  private async pushEnabled(userId: string): Promise<boolean> {
    const row = await this.db.query.userSettings.findFirst({
      columns: { notificationsEnabled: true },
      where: eq(userSettings.userId, userId),
    });
    // Default: enabled (settings row is created lazily on first settings write).
    return row ? row.notificationsEnabled : true;
  }

  private async filterPushEnabled(userIds: string[]): Promise<string[]> {
    const rows = await this.db.query.userSettings.findMany({
      columns: { userId: true, notificationsEnabled: true },
      where: inArray(userSettings.userId, userIds),
    });
    const disabled = new Set(
      rows.filter((r) => !r.notificationsEnabled).map((r) => r.userId),
    );
    return userIds.filter((id) => !disabled.has(id));
  }

  private async deliver(tokens: string[], payload: PushPayload): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    if (!this.configured || !this.projectId || !this.googleAuth) {
      this.logger.debug(
        `FCM not configured — skipping delivery to ${tokens.length} device(s)`,
      );
      return;
    }

    const client = await this.googleAuth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) {
      this.logger.warn('Could not mint FCM OAuth token — skipping delivery');
      return;
    }

    const body = JSON.stringify({
      message: {
        token: tokens.length === 1 ? tokens[0] : undefined,
        tokens: tokens.length > 1 ? tokens : undefined,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      },
    });

    const response = await fetch(FCM_ENDPOINT(this.projectId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(
        `FCM responded ${response.status}: ${text.slice(0, 500)}`,
      );
      return;
    }

    const result = (await response.json()) as FcmV1Response;
    if (result.invalid_message_count && result.invalid_message_count > 0) {
      this.logger.warn(
        `FCM rejected ${result.invalid_message_count} token(s): ${JSON.stringify(
          result.error ?? [],
        )}`,
      );
    }
  }

  private resolveServiceAccount(): ServiceAccountCreds | null {
    const json = this.configService.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    if (json) {
      try {
        const parsed = JSON.parse(json) as ServiceAccountCreds;
        if (parsed.project_id && parsed.client_email && parsed.private_key) {
          return parsed;
        }
      } catch {
        this.logger.warn('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
      }
      return null;
    }
    const projectId = this.configService.get<string>('FCM_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FCM_PRIVATE_KEY');
    if (projectId && clientEmail && privateKey) {
      return {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      };
    }
    return null;
  }
}
