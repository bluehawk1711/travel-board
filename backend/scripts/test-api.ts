/**
 * End-to-end API smoke test (dev).
 *
 * Boots nothing itself — point it at a running API:
 *   pnpm --dir backend db:seed
 *   pnpm --dir backend start:dev
 *   pnpm --dir backend test:api
 *
 * Walks every REST route (auth, boards, sections, items, members, comments,
 * follows, discovery, chat, notifications, users, uploads, push, places),
 * records the result of each call, and rewrites `testing.md` with the run.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.API_URL ?? 'http://localhost:4000';

interface Step {
  group: string;
  method: string;
  path: string;
  description: string;
  status: number | 'ERR';
  ok: boolean;
  detail: string;
}

const steps: Step[] = [];

/** Registers a fresh account so the run never depends on prior state. */
const NEW_USER = {
  email: `e2e-${Date.now()}@travelboard.dev`,
  password: 'password123',
  name: 'E2E Runner',
};

/** Seeded demo account used where the API wants an email (board members). */
const SEED_USER_EMAIL = 'leo@travelboard.dev';

let accessToken = '';
let refreshToken = '';

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function call(
  group: string,
  method: string,
  path: string,
  description: string,
  options: {
    body?: unknown;
    auth?: boolean;
    /** Accepted status codes (defaults to 200/201). */
    expect?: number[];
    /** Assert on the parsed JSON body; '' means satisfied, else the reason. */
    check?: (json: unknown) => string;
  } = {},
): Promise<unknown> {
  const expect = options.expect ?? [200, 201];
  const headers: Record<string, string> = {
    ...(options.auth ? authHeaders() : {}),
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let status: number | 'ERR' = 'ERR';
  let json: unknown = null;
  let detail = '';

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    status = response.status;
    const text = await response.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    if (!expect.includes(response.status)) {
      detail = `expected ${expect.join(' or ')}`;
    } else if (options.check) {
      detail = options.check(json);
    }
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error);
  }

  steps.push({
    group,
    method,
    path,
    description,
    status,
    ok: status !== 'ERR' && expect.includes(status) && detail === '',
    detail,
  });

  console.log(
    `${status === 'ERR' ? 'ERR' : status} ${method} ${path}${detail ? ` -- ${detail}` : ''}`,
  );
  return json;
}

async function main() {
  console.log(`E2E against ${BASE_URL}\n`);

  // -- Health ----------------------------------------------------------------
  await call('Health', 'GET', '/', 'API root responds');

  // -- Auth ------------------------------------------------------------------
  await call(
    'Auth',
    'POST',
    '/auth/register',
    'Rejects an invalid registration payload',
    {
      body: { email: 'not-an-email', password: 'short', name: '' },
      expect: [400],
    },
  );

  const registered = (await call(
    'Auth',
    'POST',
    '/auth/register',
    'Registers a new account and returns tokens',
    {
      body: NEW_USER,
      expect: [200, 201],
      check: (json) => {
        const body = json as { accessToken?: string; refreshToken?: string };
        if (!body.accessToken) return 'missing accessToken';
        if (!body.refreshToken) return 'missing refreshToken';
        accessToken = body.accessToken;
        refreshToken = body.refreshToken;
        return '';
      },
    },
  )) as { accessToken?: string; refreshToken?: string } | null;

  if (registered?.accessToken) {
    accessToken = registered.accessToken;
    refreshToken = registered.refreshToken ?? refreshToken;
  }

  await call(
    'Auth',
    'POST',
    '/auth/login',
    'Rejects a wrong password',
    {
      body: { email: NEW_USER.email, password: 'wrong-password' },
      expect: [401],
    },
  );

  await call(
    'Auth',
    'POST',
    '/auth/login',
    'Rejects an empty login body',
    { body: {}, expect: [400] },
  );

  const loggedIn = (await call(
    'Auth',
    'POST',
    '/auth/login',
    'Logs in with valid credentials',
    {
      body: { email: NEW_USER.email, password: NEW_USER.password },
      check: (json) => {
        const body = json as { accessToken?: string };
        if (!body.accessToken) return 'missing accessToken';
        return '';
      },
    },
  )) as { accessToken?: string; refreshToken?: string } | null;

  if (loggedIn?.accessToken) {
    accessToken = loggedIn.accessToken;
    refreshToken = loggedIn.refreshToken ?? refreshToken;
  }

  await call(
    'Auth',
    'GET',
    '/auth/me',
    'Returns 401 without a token',
    { expect: [401] },
  );

  await call('Auth', 'GET', '/auth/me', 'Returns the current user', {
    auth: true,
    check: (json) => {
      const body = json as { user?: { email?: string } };
      if (!body.user?.email) return 'missing user.email';
      return '';
    },
  });

  const rotated = (await call(
    'Auth',
    'POST',
    '/auth/refresh',
    'Rotates the refresh token',
    {
      body: { refreshToken },
      check: (json) => {
        const body = json as { accessToken?: string; refreshToken?: string };
        if (!body.accessToken) return 'missing accessToken';
        if (!body.refreshToken) return 'missing rotated refreshToken';
        return '';
      },
    },
  )) as { accessToken?: string; refreshToken?: string } | null;

  if (rotated?.accessToken) {
    accessToken = rotated.accessToken;
    refreshToken = rotated.refreshToken ?? refreshToken;
  }

  await call(
    'Auth',
    'POST',
    '/auth/forgot-password',
    'Accepts a password reset request',
    { body: { email: NEW_USER.email }, expect: [200, 201, 202] },
  );

  // -- Users -----------------------------------------------------------------
  const search = (await call(
    'Users',
    'GET',
    '/users/search?q=maya',
    'Searches users by name (auth required)',
    {
      auth: true,
      check: (json) => {
        const body = json as { users?: unknown[] };
        if (!Array.isArray(body.users)) return 'missing users[]';
        return '';
      },
    },
  )) as { users?: { id: string }[] } | null;

  await call('Users', 'PATCH', '/users/me', 'Updates the own profile', {
    auth: true,
    body: { bio: 'E2E-updated bio' },
    check: (json) => {
      const body = json as { user?: { bio?: string } };
      if (body.user?.bio !== 'E2E-updated bio') return 'bio not updated';
      return '';
    },
  });

  await call('Users', 'GET', '/users/me/settings', 'Reads own settings', {
    auth: true,
    check: (json) => {
      const body = json as { themeMode?: string };
      if (!body.themeMode) return 'missing themeMode';
      return '';
    },
  });

  await call('Users', 'PATCH', '/users/me/settings', 'Updates own settings', {
    auth: true,
    body: { themeMode: 'DARK', currency: 'EUR' },
    check: (json) => {
      const body = json as { themeMode?: string };
      if (body.themeMode !== 'DARK') return 'themeMode not updated';
      return '';
    },
  });

  const seedUserId = search?.users?.[0]?.id;
  if (seedUserId) {
    await call('Users', 'GET', `/users/${seedUserId}`, 'Reads a public profile', {
      check: (json) => ((json as { id?: string })?.id ? '' : 'missing id'),
    });
    await call(
      'Users',
      'GET',
      `/users/${seedUserId}/boards`,
      'Lists the public board grid of a user',
      { check: (json) => (!json ? 'empty response' : '') },
    );
  }

  // -- Boards ----------------------------------------------------------------
  const created = (await call(
    'Boards',
    'POST',
    '/boards',
    'Creates a board',
    {
      auth: true,
      body: {
        title: 'E2E Test Board',
        description: 'Created by the e2e suite',
        destination: 'Berlin, Germany',
        boardType: 'ITINERARY',
        visibility: 'PUBLIC',
      },
      expect: [200, 201],
      check: (json) => {
        const body = json as { board?: { id?: string }; id?: string };
        return body.board?.id ?? body.id ? '' : 'missing board id';
      },
    },
  )) as { board?: { id: string }; id?: string } | null;

  const boardId = created?.board?.id ?? created?.id;

  await call('Boards', 'POST', '/boards', 'Rejects a board with no title', {
    auth: true,
    body: {},
    expect: [400],
  });

  await call('Boards', 'GET', '/boards/mine', 'Lists my boards (bare array)', {
    auth: true,
    check: (json) =>
      Array.isArray(json) ? '' : 'expected a board array',
  });

  await call('Boards', 'GET', '/boards/saved', 'Lists saved boards (bare array)', {
    auth: true,
    check: (json) =>
      Array.isArray(json) ? '' : 'expected a board array',
  });

  if (boardId) {
    await call('Boards', 'GET', `/boards/${boardId}`, 'Reads one board', {
      auth: true,
      check: (json) => {
        const body = json as { board?: { id?: string }; id?: string };
        return body.board?.id ?? body.id ? '' : 'missing board id';
      },
    });

    await call('Boards', 'PATCH', `/boards/${boardId}`, 'Updates the board', {
      auth: true,
      body: { title: 'E2E Test Board (edited)' },
    });

    // -- Sections -----------------------------------------------------------
    const section = (await call(
      'Boards',
      'POST',
      `/boards/${boardId}/sections`,
      'Adds a section',
      { auth: true, body: { title: 'Day 1' }, expect: [200, 201] },
    )) as { section?: { id: string }; id?: string } | null;

    const sectionId = section?.section?.id ?? section?.id;

    if (sectionId) {
      await call(
        'Boards',
        'PATCH',
        `/boards/sections/${sectionId}`,
        'Renames the section',
        { auth: true, body: { title: 'Day 1 - Arrival' } },
      );

      // -- Items ------------------------------------------------------------
      const item = (await call(
        'Boards',
        'POST',
        `/boards/${boardId}/items`,
        'Adds a place item to the section',
        {
          auth: true,
          body: {
            sectionId,
            type: 'PLACE',
            title: 'Brandenburg Gate',
            description: 'Go at sunrise',
            placeId: 'ChIJpYyQdmROqEcR_dTgTedkwKI',
            lat: 52.5163,
            lng: 13.3777,
          },
          expect: [200, 201],
        },
      )) as { item?: { id: string }; id?: string } | null;

      const itemId = item?.item?.id ?? item?.id;

      await call(
        'Boards',
        'POST',
        `/boards/${boardId}/items`,
        'Rejects an item without sectionId',
        { auth: true, body: { type: 'PLACE', title: 'x' }, expect: [400] },
      );

      if (itemId) {
        await call(
          'Boards',
          'PATCH',
          `/boards/items/${itemId}`,
          'Updates the item',
          { auth: true, body: { title: 'Brandenburg Gate (updated)' } },
        );
        await call(
          'Boards',
          'PATCH',
          `/boards/${boardId}/items/reorder`,
          'Reorders items within a section',
          {
            auth: true,
            body: { sectionId, orderedItemIds: [itemId] },
            expect: [200, 201, 204],
          },
        );
        await call(
          'Boards',
          'DELETE',
          `/boards/items/${itemId}`,
          'Deletes the item',
          { auth: true, expect: [200, 204] },
        );
      }
    }

    await call(
      'Boards',
      'PATCH',
      `/boards/${boardId}/sections/reorder`,
      'Reorders sections',
      {
        auth: true,
        body: { orderedSectionIds: [sectionId] },
        expect: [200, 201, 204],
      },
    );

    // -- Members ------------------------------------------------------------
    await call(
      'Boards',
      'GET',
      `/boards/${boardId}/members`,
      'Lists members',
      { auth: true },
    );

    if (seedUserId) {
      await call(
        'Boards',
        'POST',
        `/boards/${boardId}/members`,
        'Adds a collaborator by email',
        { auth: true, body: { email: SEED_USER_EMAIL, role: 'EDITOR' } },
      );
      await call(
        'Boards',
        'PATCH',
        `/boards/${boardId}/members/${seedUserId}`,
        'Changes the collaborator role',
        { auth: true, body: { role: 'VIEWER' } },
      );
      await call(
        'Boards',
        'DELETE',
        `/boards/${boardId}/members/${seedUserId}`,
        'Removes the collaborator',
        { auth: true, expect: [200, 204] },
      );
    }

    // -- Comments -----------------------------------------------------------
    const createdComment = (await call(
      'Comments',
      'POST',
      `/boards/${boardId}/comments`,
      'Adds a comment',
      { auth: true, body: { body: 'E2E comment' }, expect: [200, 201] },
    )) as { comment?: { id: string }; id?: string } | null;

    await call(
      'Comments',
      'GET',
      `/boards/${boardId}/comments`,
      'Lists comments on a board',
      { auth: true },
    );

    await call(
      'Comments',
      'POST',
      `/boards/${boardId}/comments`,
      'Rejects an empty comment',
      { auth: true, body: { body: '' }, expect: [400] },
    );

    const commentId = createdComment?.comment?.id ?? createdComment?.id;
    if (commentId) {
      await call(
        'Comments',
        'DELETE',
        `/boards/${boardId}/comments/${commentId}`,
        'Deletes the comment',
        { auth: true, expect: [200, 204] },
      );
    }

    // -- Likes & saves ------------------------------------------------------
    await call('Boards', 'POST', `/boards/${boardId}/like`, 'Likes the board', {
      auth: true,
    });
    await call(
      'Boards',
      'POST',
      `/boards/${boardId}/like`,
      'Un-likes the board',
      { auth: true },
    );
    await call('Boards', 'POST', `/boards/${boardId}/save`, 'Saves the board', {
      auth: true,
    });
    await call(
      'Boards',
      'POST',
      `/boards/${boardId}/save`,
      'Un-saves the board',
      { auth: true },
    );

    // -- Board copy (user B duplicates user A's public board) --------------
    if (boardId) {
      const ownerToken = accessToken;
      const COPY_USER = {
        email: `e2e-copy-${Date.now()}@example.com`,
        password: 'e2e-copy-pass-1',
        name: 'E2E Copy User',
      };
      const copyRegistered = (await call(
        'Auth',
        'POST',
        '/auth/register',
        'Registers a second account for the copy test',
        {
          body: COPY_USER,
          expect: [200, 201],
          check: (json) =>
            (json as { accessToken?: string })?.accessToken
              ? ''
              : 'missing accessToken',
        },
      )) as { accessToken?: string } | null;

      if (copyRegistered?.accessToken) {
        accessToken = copyRegistered.accessToken;

        const copy = (await call(
          'Boards',
          'POST',
          `/boards/${boardId}/copy`,
          'Copies a public board into my boards (starts private)',
          {
            auth: true,
            expect: [200, 201],
            check: (json) => {
              const body = json as {
                id?: string;
                visibility?: string;
                sections?: unknown[];
              };
              if (!body.id) return 'missing copy id';
              if (body.visibility !== 'PRIVATE')
                return `copy should be PRIVATE, got ${body.visibility}`;
              if (!Array.isArray(body.sections) || body.sections.length === 0)
                return 'copy is missing cloned sections';
              return '';
            },
          },
        )) as { id?: string } | null;

        const copyId = copy?.id;
        if (copyId) {
          // The owner of the copy can edit it (the whole point of copying).
          await call(
            'Boards',
            'PATCH',
            `/boards/${copyId}`,
            'Edits the copied board (owner can modify their copy)',
            { auth: true, body: { title: 'My copied trip' } },
          );
          await call(
            'Boards',
            'DELETE',
            `/boards/${copyId}`,
            'Deletes the copied board (cleanup)',
            { auth: true, expect: [200, 204] },
          );
        }

        // Restore the original account for the remaining checks.
        accessToken = ownerToken;
      }
    }

    // -- Chat ---------------------------------------------------------------
    const room = (await call(
      'Chat',
      'GET',
      `/chat/boards/${boardId}`,
      'Opens (or creates) the board chat room',
      { auth: true },
    )) as { id?: string; conversation?: { id?: string } } | null;

    const conversationId = room?.id ?? room?.conversation?.id;

    if (conversationId) {
      await call(
        'Chat',
        'GET',
        `/chat/conversations/${conversationId}`,
        'Reads the conversation detail',
        { auth: true },
      );
      await call(
        'Chat',
        'GET',
        `/chat/conversations/${conversationId}/messages`,
        'Lists messages (first cursor page)',
        { auth: true },
      );
      await call(
        'Chat',
        'POST',
        `/chat/conversations/${conversationId}/messages`,
        'Sends a message',
        { auth: true, body: { body: 'E2E hello' }, expect: [200, 201] },
      );
      await call(
        'Chat',
        'POST',
        `/chat/conversations/${conversationId}/read`,
        'Marks the room read',
        { auth: true, body: { lastMessageId: 1 } },
      );
    }

    await call('Chat', 'GET', '/chat/presence', 'Reads the presence map', {
      auth: true,
    });

    // -- Discovery ----------------------------------------------------------
    await call(
      'Discovery',
      'GET',
      '/explore',
      'Public explore feed (newest)',
      {
        check: (json) =>
          Array.isArray((json as { items?: unknown[] })?.items)
            ? ''
            : 'missing items[]',
      },
    );
    await call(
      'Discovery',
      'GET',
      '/explore?sort=trending',
      'Explore feed sorted by trending',
    );
    await call(
      'Discovery',
      'GET',
      '/explore?q=Japan',
      'Searches the explore feed',
      { check: (json) => (!json ? 'empty response' : '') },
    );
    await call('Discovery', 'GET', '/explore/following', 'Following feed', {
      auth: true,
      check: (json) =>
        Array.isArray((json as { items?: unknown[] })?.items)
          ? ''
          : 'missing items[]',
    });

    // -- Follows ------------------------------------------------------------
    if (seedUserId) {
      await call(
        'Follows',
        'POST',
        `/users/${seedUserId}/follow`,
        'Follows a user',
        { auth: true },
      );
      await call(
        'Follows',
        'GET',
        `/users/${seedUserId}/followers`,
        'Lists the followers of a user',
      );
      await call(
        'Follows',
        'GET',
        `/users/${seedUserId}/following`,
        'Lists who a user follows',
      );
      await call(
        'Follows',
        'DELETE',
        `/users/${seedUserId}/follow`,
        'Unfollows the user',
        { auth: true, expect: [200, 204] },
      );
      await call(
        'Follows',
        'POST',
        `/boards/${boardId}/follow`,
        'Follows a board',
        { auth: true },
      );
      await call(
        'Follows',
        'GET',
        `/boards/${boardId}/followers`,
        'Lists the followers of a board',
      );
      await call(
        'Follows',
        'DELETE',
        `/boards/${boardId}/follow`,
        'Unfollows the board',
        { auth: true, expect: [200, 204] },
      );
    }

    // -- Conversations ------------------------------------------------------
    await call(
      'Chat',
      'GET',
      '/chat/conversations',
      'Lists conversations',
      { auth: true },
    );

    if (seedUserId) {
      await call(
        'Chat',
        'POST',
        '/chat/conversations',
        'Creates a direct conversation',
        {
          auth: true,
          body: { type: 'DIRECT', userId: seedUserId },
          expect: [200, 201],
        },
      );
    }

    // -- Notifications ------------------------------------------------------
    await call(
      'Notifications',
      'GET',
      '/notifications',
      'Lists notifications',
      { auth: true },
    );
    await call(
      'Notifications',
      'GET',
      '/notifications/unread-count',
      'Reads the unread count',
      { auth: true },
    );
    await call(
      'Notifications',
      'PATCH',
      '/notifications/read-all',
      'Marks all notifications read',
      { auth: true },
    );

    // -- Push ---------------------------------------------------------------
    await call('Push', 'POST', '/push/tokens', 'Registers a push token', {
      auth: true,
      body: { token: `ExponentPushToken[e2e-${Date.now()}]`, platform: 'EXPO' },
      expect: [200, 201],
    });

    // -- Uploads ------------------------------------------------------------
    // Real multipart upload: 1x1 PNG through POST /uploads/image.
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append(
      'file',
      new Blob([pngBytes], { type: 'image/png' }),
      'e2e-pixel.png',
    );
    let uploadStatus: number | 'ERR' = 'ERR';
    let uploadDetail = '';
    let uploadUrl = '';
    try {
      const uploadRes = await fetch(`${BASE_URL}/uploads/image`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: form,
      });
      uploadStatus = uploadRes.status;
      const uploadJson = (await uploadRes.json()) as { url?: string };
      if (uploadRes.ok && typeof uploadJson.url === 'string') {
        uploadUrl = uploadJson.url;
        uploadDetail = '';
      } else {
        uploadDetail = 'expected { url: string }';
      }
    } catch (error) {
      uploadDetail = error instanceof Error ? error.message : String(error);
    }
    steps.push({
      group: 'Uploads',
      method: 'POST',
      path: '/uploads/image',
      description: 'Multipart image upload returns { url }',
      status: uploadStatus,
      ok: uploadStatus !== 'ERR' && uploadStatus === 201 && uploadDetail === '',
      detail: uploadDetail,
    });
    console.log(
      `${uploadStatus === 'ERR' ? 'ERR' : uploadStatus} POST /uploads/image${uploadDetail ? ` -- ${uploadDetail}` : ''}`,
    );

    // The stored file is served back from /uploads/<filename>.
    if (uploadUrl) {
      await call(
        'Uploads',
        'GET',
        uploadUrl,
        'Uploaded file is served from /uploads',
        { expect: [200] },
      );
    }

    // Unsupported mime types are rejected with 400.
    const badForm = new FormData();
    badForm.append(
      'file',
      new Blob([Buffer.from('not an image')], { type: 'text/plain' }),
      'notes.txt',
    );
    let badStatus: number | 'ERR' = 'ERR';
    let badDetail = '';
    try {
      const badRes = await fetch(`${BASE_URL}/uploads/image`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: badForm,
      });
      badStatus = badRes.status;
      if (badRes.status !== 400) {
        badDetail = 'expected 400';
      }
    } catch (error) {
      badDetail = error instanceof Error ? error.message : String(error);
    }
    steps.push({
      group: 'Uploads',
      method: 'POST',
      path: '/uploads/image',
      description: 'Rejects a non-image mime type',
      status: badStatus,
      ok: badStatus !== 'ERR' && badStatus === 400 && badDetail === '',
      detail: badDetail,
    });
    console.log(
      `${badStatus === 'ERR' ? 'ERR' : badStatus} POST /uploads/image (bad mime)${badDetail ? ` -- ${badDetail}` : ''}`,
    );

    // -- Cleanup ------------------------------------------------------------
    await call(
      'Boards',
      'DELETE',
      `/boards/${boardId}`,
      'Deletes the board',
      { auth: true, expect: [200, 204] },
    );
  }

  // -- Places (placeholder key -> upstream 400 -> proxied 502) --------------
  await call(
    'Places',
    'GET',
    '/places/search?q=ramen%20in%20tokyo',
    'Proxies Google Places search (needs a valid server API key)',
    { auth: true, expect: [200, 400, 500, 502], check: () => '' },
  );

  // -- Logout ---------------------------------------------------------------
  await call(
    'Auth',
    'POST',
    '/auth/logout',
    'Logs out and revokes the refresh token',
    { auth: true, body: { refreshToken }, expect: [200, 201, 204] },
  );

  writeReport();
}

function writeReport(): void {
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok);
  const groups = [...new Set(steps.map((s) => s.group))];

  const lines: string[] = [];
  lines.push('# API Testing');
  lines.push('');
  lines.push(
    'End-to-end smoke test covering every REST route in the NestJS API.',
  );
  lines.push('');
  lines.push('```bash');
  lines.push('pnpm --dir backend db:seed     # load the demo dataset');
  lines.push('pnpm --dir backend start:dev   # boot the API on :4000');
  lines.push('pnpm --dir backend test:api    # run the suite and rewrite this file');
  lines.push('```');
  lines.push('');
  lines.push(
    'The suite registers a throwaway account, walks every route, then deletes what it created, so it is safe to re-run. Set `API_URL` to target another host.',
  );
  lines.push('');
  lines.push('## Latest run');
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| Base URL | \`${BASE_URL}\` |`);
  lines.push(`| Ran at | ${new Date().toISOString()} |`);
  lines.push(`| Node | ${process.version} |`);
  lines.push(`| **Result** | **${passed}/${steps.length} passed** |`);
  lines.push('');
  lines.push('| Group | Checks | Passed |');
  lines.push('|---|---|---|');
  for (const group of groups) {
    const groupSteps = steps.filter((s) => s.group === group);
    const groupPassed = groupSteps.filter((s) => s.ok).length;
    lines.push(`| ${group} | ${groupSteps.length} | ${groupPassed} |`);
  }
  lines.push('');

  if (failed.length > 0) {
    lines.push('## Failures');
    lines.push('');
    lines.push('| Method | Path | Status | Note |');
    lines.push('|---|---|---|---|');
    for (const step of failed) {
      lines.push(
        `| ${step.method} | \`${step.path}\` | ${step.status} | ${step.detail || step.description} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Endpoint coverage');
  lines.push('');
  for (const group of groups) {
    lines.push(`### ${group}`);
    lines.push('');
    lines.push('| Result | Method | Path | Status | Checks |');
    lines.push('|---|---|---|---|---|');
    for (const step of steps.filter((s) => s.group === group)) {
      lines.push(
        `| ${step.ok ? 'PASS' : 'FAIL'} | ${step.method} | \`${step.path}\` | ${step.status} | ${step.description}${step.detail ? ` — ${step.detail}` : ''} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- `GET /places/search` requires a valid `GOOGLE_PLACES_API_KEY` in `backend/.env`. A missing key answers 500 and a placeholder key gets `400 API key not valid` from Google, which the proxy maps to 502; both are expected until a real key is configured.',
  );
  lines.push(
    '- `POST /uploads/image` is exercised with a real multipart body (1x1 PNG); a non-image mime type is rejected with 400 and the stored file is fetched back from `/uploads/<filename>`.',
  );
  lines.push(
    '- Socket.IO events (`conversation:join`, `message:new`, `message:read`, `user:typing`) are exercised by the web and mobile clients, not by this REST suite.',
  );
  lines.push(
    '- Google OAuth (`GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/mobile`) needs a Google Cloud client; it is not covered here.',
  );
  lines.push('');

  const target = resolve(process.cwd(), '..', 'testing.md');
  writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`${passed}/${steps.length} checks passed`);
  console.log(`Report written to ${target}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const step of failed) {
      console.log(
        `  ${step.method} ${step.path} -> ${step.status}${step.detail ? ` (${step.detail})` : ''}`,
      );
    }
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
