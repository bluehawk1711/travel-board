import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { passwordResetTokens, refreshTokens, users } from '../db/schema';
import { MESSAGES } from '../common/messages';
import { MailService } from '../common/mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Sanitized user shape — never contains passwordHash. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface GoogleProfile {
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Verifies Google id_tokens for the mobile token-exchange endpoint. */
  private readonly oauthClient = new OAuth2Client();

  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<TokensResponse> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });
    if (existing) {
      throw new ConflictException(MESSAGES.AUTH.EMAIL_EXISTS);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const [user] = await this.db
      .insert(users)
      .values({ email: dto.email.toLowerCase(), name: dto.name, passwordHash })
      .returning();

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto): Promise<TokensResponse> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    return this.issueTokens(user.id);
  }

  /** Verifies + rotates a refresh token: revokes the old one, issues a new pair. */
  async refresh(refreshToken: string): Promise<TokensResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.userId, payload.sub),
        isNull(refreshTokens.revokedAt),
      ),
    });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }

    await this.revokeRefreshToken(stored.id);
    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken).catch(
      () => null,
    );
    if (!payload) {
      return; // already invalid — nothing to revoke
    }
    const stored = await this.db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.tokenHash, this.hashToken(refreshToken)),
        eq(refreshTokens.userId, payload.sub),
      ),
    });
    if (stored) {
      await this.revokeRefreshToken(stored.id);
    }
  }

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
    const email = profile.email.toLowerCase();
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return this.toAuthUser(existing);
    }
    const [user] = await this.db
      .insert(users)
      .values({
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        // no passwordHash — account can only sign in via Google
      })
      .returning();
    return this.toAuthUser(user);
  }

  /**
   * Mobile Google sign-in: verify the app-supplied id_token against Google,
   * find-or-create the user, then issue the app's own JWT pair.
   */
  async googleMobileSignIn(idToken: string): Promise<TokensResponse> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const ticket = await this.oauthClient
      .verifyIdToken({ idToken, audience: clientId })
      .catch(() => {
        throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_ID_TOKEN_INVALID);
      });

    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!payload?.sub || !email || payload.email_verified === false) {
      throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_NO_EMAIL);
    }
    if (payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_ID_TOKEN_EXPIRED);
    }

    const user = await this.findOrCreateGoogleUser({
      email,
      name: payload.name ?? email.split('@')[0],
      avatarUrl: payload.picture ?? null,
    });
    return this.issueTokens(user.id);
  }

  async getUserById(id: string): Promise<AuthUser> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) {
      throw new UnauthorizedException(MESSAGES.AUTH.USER_NOT_FOUND);
    }
    return this.toAuthUser(user);
  }

  async issueTokens(userId: string): Promise<TokensResponse> {
    const user = await this.getUserById(userId);
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return { accessToken, refreshToken, user };
  }

  // ── Password Reset ─────────────────────────────────────

  async forgotPassword(email: string): Promise<{ success: boolean }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
    // Always return success to prevent email enumeration.
    if (!user || !user.passwordHash) {
      return { success: true };
    }

    // Generate a random token and store its hash.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    await this.mailService
      .sendPasswordResetEmail(user.email, rawToken, frontendUrl)
      .catch((err) => {
        this.logger.error('Failed to send password reset email', err);
      });

    return { success: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<TokensResponse> {
    const tokenHash = this.hashToken(token);
    const stored = await this.db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
      ),
    });

    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_RESET_TOKEN);
    }

    // Mark token as used.
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, stored.id));

    // Update password.
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, stored.userId));

    // Issue new tokens so the user is logged in after reset.
    return this.issueTokens(stored.userId);
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string }> {
    try {
      return await this.jwtService.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }
  }

  private async revokeRefreshToken(id: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }
}
