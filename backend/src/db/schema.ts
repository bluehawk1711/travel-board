import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
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

// ─────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
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
});

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
