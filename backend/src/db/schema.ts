import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

/** Item types from plan.md: PLACE | IMAGE | NOTE | LINK | RESTAURANT | HOTEL | ACTIVITY */
export const boardItemTypeEnum = pgEnum('board_item_type', [
  'PLACE',
  'IMAGE',
  'NOTE',
  'LINK',
  'RESTAURANT',
  'HOTEL',
  'ACTIVITY',
]);

/** Boards are either day-based itineraries or freeform collections. */
export const boardTypeEnum = pgEnum('board_type', ['ITINERARY', 'FREEFORM']);

export const boardVisibilityEnum = pgEnum('board_visibility', [
  'PUBLIC',
  'PRIVATE',
]);

export const boardMemberRoleEnum = pgEnum('board_member_role', [
  'OWNER',
  'EDITOR',
  'VIEWER',
]);

/** Follows are polymorphic: a user can follow a user or a board. */
export const followTargetTypeEnum = pgEnum('follow_target_type', [
  'USER',
  'BOARD',
]);

/** Chat conversation types: direct 1:1, group, or per-board collaboration room. */
export const conversationTypeEnum = pgEnum('conversation_type', [
  'DIRECT',
  'GROUP',
  'BOARD',
]);

// ─────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    /** Null for OAuth-only accounts (e.g. Google login). */
    passwordHash: text('password_hash'),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Not auto-maintained by Drizzle — services must set it on update. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Trigram GIN index for ILIKE '%query%' search on name (H4).
    // Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm; (scripts/seed.ts does
    // this — Drizzle cannot express extensions).
    // NOTE: no `.concurrently()` — drizzle-kit runs migrations inside a
    // transaction and Postgres forbids CONCURRENTLY there.
    index('users_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
  ],
);

// ─────────────────────────────────────────────────────────────
// boards
// ─────────────────────────────────────────────────────────────

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    /** Free-form destination label, e.g. "Tokyo, Japan". */
    destination: text('destination'),
    boardType: boardTypeEnum('board_type').notNull().default('FREEFORM'),
    visibility: boardVisibilityEnum('visibility').notNull().default('PUBLIC'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('boards_owner_id_idx').on(table.ownerId),
    index('boards_visibility_created_idx').on(
      table.visibility,
      table.createdAt,
    ),
    // Trigram GIN index for ILIKE '%query%' search on title (H4).
    // Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm; (see scripts/seed.ts).
    // No `.concurrently()` — it cannot run inside a migration transaction.
    index('boards_title_trgm_idx').using(
      'gin',
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────
// board_members  (owner / editor / viewer)
// ─────────────────────────────────────────────────────────────

export const boardMembers = pgTable(
  'board_members',
  {
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: boardMemberRoleEnum('role').notNull().default('VIEWER'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.boardId, table.userId] }),
    index('board_members_user_id_idx').on(table.userId),
  ],
);

// ─────────────────────────────────────────────────────────────
// board_sections  (e.g. "Day 1", or freeform groups)
// ─────────────────────────────────────────────────────────────

export const boardSections = pgTable(
  'board_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** 0-based ordering; reordering updates this column. Not unique so reorders don't collide. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('board_sections_board_position_idx').on(
      table.boardId,
      table.position,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────
// board_items  (place, image, note, link, restaurant, hotel, activity)
// ─────────────────────────────────────────────────────────────

export const boardItems = pgTable(
  'board_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Denormalized onto the item for cheap feed queries (matches plan.md fields). */
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => boardSections.id, { onDelete: 'cascade' }),
    type: boardItemTypeEnum('type').notNull(),
    /** Google Places ID — null for NOTE / IMAGE / LINK items. */
    placeId: text('place_id'),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    /** Used by LINK items. */
    url: text('url'),
    /** 0-based ordering within the section. */
    position: integer('position').notNull().default(0),
    /** Coordinates copied from the Places result — drives the board map view. */
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    /** Per-item date for ITINERARY boards (features.md §7). */
    date: date('date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('board_items_section_position_idx').on(
      table.sectionId,
      table.position,
    ),
    index('board_items_board_id_idx').on(table.boardId),
  ],
);

// ─────────────────────────────────────────────────────────────
// board_saves  (users saving other boards into "my boards")
// ─────────────────────────────────────────────────────────────

export const boardSaves = pgTable(
  'board_saves',
  {
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.boardId] }),
    index('board_saves_board_id_idx').on(table.boardId),
  ],
);

// ─────────────────────────────────────────────────────────────
// refresh_tokens  (JWT refresh tokens for the auth module)
// ─────────────────────────────────────────────────────────────

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hash of the raw refresh JWT — never store the token itself. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_token_hash_idx').on(table.tokenHash),
  ],
);

// ─────────────────────────────────────────────────────────────
// conversations  (1:1 DMs, group chats, and per-board chat rooms)
// ─────────────────────────────────────────────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: conversationTypeEnum('type').notNull().default('DIRECT'),
    /** Set for BOARD conversations only. */
    boardId: uuid('board_id').references(() => boards.id, {
      onDelete: 'cascade',
    }),
    /** Group chat name; null for DIRECT / BOARD conversations. */
    name: text('name'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Last activity (message sent) — used to sort the conversation list. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('conversations_updated_at_idx').on(table.updatedAt)],
);

// ─────────────────────────────────────────────────────────────
// conversation_members
// ─────────────────────────────────────────────────────────────

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** messages.id the user has read up to (inclusive); null = nothing read. */
    lastReadMessageId: bigint('last_read_message_id', { mode: 'number' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index('conversation_members_user_id_idx').on(table.userId),
  ],
);

// ─────────────────────────────────────────────────────────────
// messages  (chat history — Postgres is the source of truth)
// ─────────────────────────────────────────────────────────────

export const messages = pgTable(
  'messages',
  {
    /** Sequential identity — used for cursor pagination and read-tracking. */
    id: bigint('id', { mode: 'number' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('messages_conversation_id_idx').on(table.conversationId)],
);

// ─────────────────────────────────────────────────────────────
// follows  (user → user / user → board, polymorphic target)
// ─────────────────────────────────────────────────────────────

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: followTargetTypeEnum('target_type').notNull(),
    /** Polymorphic: users.id when targetType = USER, boards.id when targetType = BOARD. */
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.followerId, table.targetType, table.targetId],
    }),
    index('follows_target_idx').on(table.targetType, table.targetId),
  ],
);

// ─────────────────────────────────────────────────────────────
// likes
// ─────────────────────────────────────────────────────────────

export const likes = pgTable(
  'likes',
  {
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.boardId] }),
    index('likes_board_id_idx').on(table.boardId),
  ],
);

// ─────────────────────────────────────────────────────────────
// comments
// ─────────────────────────────────────────────────────────────

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('comments_board_created_idx').on(table.boardId, table.createdAt),
    index('comments_user_id_idx').on(table.userId),
  ],
);

// ─────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────
// Note: `follows.targetId` is polymorphic (users or boards) and has no FK,
// so only the follower side gets a typed relation.

export const usersRelations = relations(users, ({ many }) => ({
  boards: many(boards),
  memberships: many(boardMembers),
  saves: many(boardSaves),
  likes: many(likes),
  comments: many(comments),
  refreshTokens: many(refreshTokens),
  following: many(follows),
  conversationsCreated: many(conversations),
  chatMemberships: many(conversationMembers),
  sentMessages: many(messages),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  owner: one(users, { fields: [boards.ownerId], references: [users.id] }),
  members: many(boardMembers),
  sections: many(boardSections),
  items: many(boardItems),
  saves: many(boardSaves),
  likes: many(likes),
  comments: many(comments),
}));

export const boardMembersRelations = relations(boardMembers, ({ one }) => ({
  board: one(boards, {
    fields: [boardMembers.boardId],
    references: [boards.id],
  }),
  user: one(users, { fields: [boardMembers.userId], references: [users.id] }),
}));

export const boardSectionsRelations = relations(
  boardSections,
  ({ one, many }) => ({
    board: one(boards, {
      fields: [boardSections.boardId],
      references: [boards.id],
    }),
    items: many(boardItems),
  }),
);

export const boardItemsRelations = relations(boardItems, ({ one }) => ({
  board: one(boards, { fields: [boardItems.boardId], references: [boards.id] }),
  section: one(boardSections, {
    fields: [boardItems.sectionId],
    references: [boardSections.id],
  }),
}));

export const boardSavesRelations = relations(boardSaves, ({ one }) => ({
  board: one(boards, { fields: [boardSaves.boardId], references: [boards.id] }),
  user: one(users, { fields: [boardSaves.userId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

// ─────────────────────────────────────────────────────────────
// password_reset_tokens  (for forgot / reset password flow)
// ─────────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hash of the raw token — never store the token itself. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('password_reset_tokens_user_id_idx').on(table.userId),
    index('password_reset_tokens_token_hash_idx').on(table.tokenHash),
  ],
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  board: one(boards, { fields: [likes.boardId], references: [boards.id] }),
  user: one(users, { fields: [likes.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  board: one(boards, { fields: [comments.boardId], references: [boards.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    board: one(boards, {
      fields: [conversations.boardId],
      references: [boards.id],
    }),
    creator: one(users, {
      fields: [conversations.createdBy],
      references: [users.id],
    }),
    members: many(conversationMembers),
    messages: many(messages),
  }),
);

export const conversationMembersRelations = relations(
  conversationMembers,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMembers.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

// ─────────────────────────────────────────────────────────────
// user_settings
// ─────────────────────────────────────────────────────────────

export const themeModeEnum = pgEnum('theme_mode', ['SYSTEM', 'LIGHT', 'DARK']);

/** Per-user preferences (1:1 with users). Created on first read or signup. */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  themeMode: themeModeEnum('theme_mode').notNull().default('SYSTEM'),
  notificationsEnabled: boolean('notifications_enabled')
    .notNull()
    .default(true),
  emailUpdates: boolean('email_updates').notNull().default(false),
  /** ISO 4217 currency code used for budget display. */
  currency: text('currency').notNull().default('USD'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// push_tokens  (device push tokens for FCM / Expo push)
// ─────────────────────────────────────────────────────────────

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Device push token (Expo push token on mobile, FCM vapid subscription on web). */
    token: text('token').notNull().unique(),
    /** Platform: EXPO | FCM | WEB_PUSH */
    platform: text('platform').notNull().default('EXPO'),
    /** Last time this token was verified/used. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('push_tokens_user_id_idx').on(table.userId)],
);

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// notifications
// ─────────────────────────────────────────────────────────────

export const notificationTypes = pgEnum('notification_type', [
  'NEW_FOLLOWER',
  'NEW_BOARD_FOLLOWER',
  'NEW_COMMENT',
  'NEW_LIKE',
  'NEW_SAVE',
  'NEW_CHAT_MESSAGE',
  'MENTION',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypes('type').notNull(),
    /** Actor user id (who triggered the notification). */
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Target entity id (board id, comment id, conversation id, etc.) */
    targetId: uuid('target_id'),
    /** Target entity type (BOARD, COMMENT, CONVERSATION, USER). */
    targetType: text('target_type'),
    /** Optional metadata as JSON (e.g. comment excerpt, board title). */
    metadata: jsonb('metadata'),
    /** Whether the user has read this notification. */
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_read_idx').on(table.userId, table.read),
    index('notifications_created_idx').on(table.createdAt),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type BoardMember = typeof boardMembers.$inferSelect;
export type BoardSection = typeof boardSections.$inferSelect;
export type BoardItem = typeof boardItems.$inferSelect;
export type BoardSave = typeof boardSaves.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UserSettingsRow = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
