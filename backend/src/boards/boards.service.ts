import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Redis } from '@upstash/redis';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import {
  boardItems,
  boardMembers,
  boards,
  boardSections,
  boardSaves,
  likes,
  users,
} from '../db/schema';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { MESSAGES } from '../common/messages';
import { CountersService } from '../counters/counters.service';
import type { AuthUser } from '../auth/auth.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';
const EDITOR_ROLES: BoardRole[] = ['OWNER', 'EDITOR'];

export interface BoardMemberRow {
  userId: string;
  role: BoardRole;
  user?: { id: string; name: string; email: string; avatarUrl: string | null };
}

@Injectable()
export class BoardsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly countersService: CountersService,
  ) {}

  // ── Permission helpers ────────────────────────────────────

  private async getRole(
    boardId: string,
    userId: string | undefined,
  ): Promise<BoardRole | null> {
    if (!userId) {
      return null;
    }
    const board = await this.db.query.boards.findFirst({
      columns: { ownerId: true },
      where: eq(boards.id, boardId),
    });
    if (!board) {
      return null;
    }
    if (board.ownerId === userId) {
      return 'OWNER';
    }
    const member = await this.db.query.boardMembers.findFirst({
      where: and(
        eq(boardMembers.boardId, boardId),
        eq(boardMembers.userId, userId),
      ),
    });
    return member?.role ?? null;
  }

  private assertCanEdit(role: BoardRole | null): void {
    if (!role || !EDITOR_ROLES.includes(role)) {
      throw new ForbiddenException(MESSAGES.BOARDS.NEED_EDITOR_ACCESS);
    }
  }

  private assertIsOwner(role: BoardRole | null): void {
    if (role !== 'OWNER') {
      throw new ForbiddenException(MESSAGES.BOARDS.OWNER_ONLY);
    }
  }

  /** Feed version bump — invalidates cached explore feeds (architecture.md §5.5). */
  private async bumpFeedVersion(): Promise<void> {
    await this.redis.incr('v:feed:explore').catch(() => undefined);
  }

  // ── Boards CRUD ───────────────────────────────────────────

  async create(user: AuthUser, dto: CreateBoardDto) {
    const board = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(boards)
        .values({
          ownerId: user.id,
          title: dto.title,
          description: dto.description,
          destination: dto.destination,
          boardType: dto.boardType ?? 'FREEFORM',
          visibility: dto.visibility ?? 'PUBLIC',
          startDate: dto.startDate ?? null,
          endDate: dto.endDate ?? null,
          coverImageUrl: dto.coverImageUrl ?? null,
        })
        .returning();
      await tx
        .insert(boardMembers)
        .values({ boardId: created.id, userId: user.id, role: 'OWNER' });
      return created;
    });

    if (board.visibility === 'PUBLIC') {
      await this.bumpFeedVersion();
    }
    return this.findOne(board.id, user);
  }

  /** Boards the user owns, is a member of, or has saved. */
  async findMine(user: AuthUser) {
    const owned = await this.db.query.boards.findMany({
      where: eq(boards.ownerId, user.id),
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
    const memberRows = await this.db
      .select({ board: boards })
      .from(boardMembers)
      .innerJoin(boards, eq(boardMembers.boardId, boards.id))
      .where(eq(boardMembers.userId, user.id));
    const savedRows = await this.db
      .select({ board: boards })
      .from(boardSaves)
      .innerJoin(boards, eq(boardSaves.boardId, boards.id))
      .where(eq(boardSaves.userId, user.id));

    const seen = new Set<string>(owned.map((b) => b.id));
    const extras = [...memberRows, ...savedRows]
      .map((r) => r.board)
      .filter((b) => !seen.has(b.id) && (seen.add(b.id), true));

    return this.decorateBoards([...owned, ...extras], user);
  }

  async findOne(boardId: string, viewer?: AuthUser) {
    const board = await this.db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        owner: { columns: { id: true, name: true, avatarUrl: true } },
        sections: {
          orderBy: (s, { asc }) => [asc(s.position)],
          with: {
            items: { orderBy: (i, { asc }) => [asc(i.position)] },
          },
        },
      },
    });
    if (!board) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }

    const role = await this.getRole(boardId, viewer?.id);
    if (board.visibility === 'PRIVATE' && !role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }

    const [memberCount, itemCount] = await Promise.all([
      this.countRows(boardMembers, boardId),
      this.countRows(boardItems, boardId),
    ]);
    const [likeCount, saveCount, liked, saved] = await Promise.all([
      this.countersService.likeCount(boardId),
      this.countersService.saveCount(boardId),
      viewer
        ? this.countersService.didUserLike(boardId, viewer.id)
        : Promise.resolve(false),
      viewer ? this.didUserSave(boardId, viewer.id) : Promise.resolve(false),
    ]);

    return {
      ...board,
      role,
      memberCount,
      itemCount,
      likeCount,
      saveCount,
      liked,
      saved,
    };
  }

  async update(boardId: string, user: AuthUser, dto: UpdateBoardDto) {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    this.assertCanEdit(role);

    await this.db
      .update(boards)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(boards.id, boardId));

    if (
      dto.visibility === 'PUBLIC' ||
      (dto.visibility === 'PRIVATE' && role === 'OWNER')
    ) {
      await this.bumpFeedVersion();
    }
    return this.findOne(boardId, user);
  }

  async remove(boardId: string, user: AuthUser): Promise<{ deleted: boolean }> {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    this.assertIsOwner(role);
    await this.db.delete(boards).where(eq(boards.id, boardId));
    await this.bumpFeedVersion();
    return { deleted: true };
  }

  // ── Sections ──────────────────────────────────────────────

  async createSection(boardId: string, user: AuthUser, dto: CreateSectionDto) {
    const role = await this.getRole(boardId, user.id);
    this.assertCanEdit(role);
    const [section] = await this.db
      .insert(boardSections)
      .values({ boardId, title: dto.title, position: dto.position ?? 0 })
      .returning();
    return section;
  }

  async updateSection(
    sectionId: string,
    user: AuthUser,
    dto: UpdateSectionDto,
  ) {
    const section = await this.requireSection(sectionId);
    const role = await this.getRole(section.boardId, user.id);
    this.assertCanEdit(role);
    const [updated] = await this.db
      .update(boardSections)
      .set(dto)
      .where(eq(boardSections.id, sectionId))
      .returning();
    return updated;
  }

  async removeSection(
    sectionId: string,
    user: AuthUser,
  ): Promise<{ deleted: boolean }> {
    const section = await this.requireSection(sectionId);
    const role = await this.getRole(section.boardId, user.id);
    this.assertCanEdit(role);
    await this.db.delete(boardSections).where(eq(boardSections.id, sectionId));
    return { deleted: true };
  }

  // ── Items ─────────────────────────────────────────────────

  async createItem(boardId: string, user: AuthUser, dto: CreateItemDto) {
    const role = await this.getRole(boardId, user.id);
    this.assertCanEdit(role);

    const section = await this.db.query.boardSections.findFirst({
      where: eq(boardSections.id, dto.sectionId),
    });
    if (!section || section.boardId !== boardId) {
      throw new BadRequestException(MESSAGES.BOARDS.SECTION_NOT_IN_BOARD);
    }

    const [item] = await this.db
      .insert(boardItems)
      .values({
        boardId,
        sectionId: dto.sectionId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        url: dto.url ?? null,
        placeId: dto.placeId ?? null,
        position: dto.position ?? 0,
        date: dto.date ?? null,
      })
      .returning();
    return item;
  }

  async updateItem(itemId: string, user: AuthUser, dto: UpdateItemDto) {
    const item = await this.requireItem(itemId);
    const role = await this.getRole(item.boardId, user.id);
    this.assertCanEdit(role);
    const [updated] = await this.db
      .update(boardItems)
      .set(dto)
      .where(eq(boardItems.id, itemId))
      .returning();
    return updated;
  }

  async removeItem(
    itemId: string,
    user: AuthUser,
  ): Promise<{ deleted: boolean }> {
    const item = await this.requireItem(itemId);
    const role = await this.getRole(item.boardId, user.id);
    this.assertCanEdit(role);
    await this.db.delete(boardItems).where(eq(boardItems.id, itemId));
    return { deleted: true };
  }

  /** Reorders items within one section by replacing their position values. */
  async reorderItems(boardId: string, user: AuthUser, dto: ReorderItemsDto) {
    const role = await this.getRole(boardId, user.id);
    this.assertCanEdit(role);

    const section = await this.db.query.boardSections.findFirst({
      where: eq(boardSections.id, dto.sectionId),
    });
    if (!section || section.boardId !== boardId) {
      throw new BadRequestException(MESSAGES.BOARDS.SECTION_NOT_IN_BOARD);
    }

    const existing = await this.db
      .select({ id: boardItems.id })
      .from(boardItems)
      .where(
        and(
          eq(boardItems.boardId, boardId),
          eq(boardItems.sectionId, dto.sectionId),
        ),
      );
    const validIds = new Set(existing.map((i) => i.id));
    if (
      dto.orderedItemIds.length !== existing.length ||
      dto.orderedItemIds.some((id) => !validIds.has(id))
    ) {
      throw new BadRequestException(MESSAGES.BOARDS.INVALID_REORDER);
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of dto.orderedItemIds.entries()) {
        await tx
          .update(boardItems)
          .set({ position: index })
          .where(eq(boardItems.id, id));
      }
    });
    return { reordered: true };
  }

  // ── Members ───────────────────────────────────────────────

  async listMembers(
    boardId: string,
    user: AuthUser,
  ): Promise<BoardMemberRow[]> {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    const rows = await this.db
      .select({
        userId: boardMembers.userId,
        role: boardMembers.role,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(boardMembers)
      .innerJoin(users, eq(boardMembers.userId, users.id))
      .where(eq(boardMembers.boardId, boardId));
    return rows.map((r) => ({
      userId: r.userId,
      role: r.role,
      user: {
        id: r.userId,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatarUrl,
      },
    }));
  }

  async addMember(boardId: string, user: AuthUser, dto: AddMemberDto) {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    this.assertIsOwner(role);

    const target = await this.db.query.users.findFirst({
      columns: { id: true, email: true, name: true, avatarUrl: true },
      where: eq(users.email, dto.email.toLowerCase()),
    });
    if (!target) {
      throw new NotFoundException(MESSAGES.BOARDS.USER_EMAIL_NOT_FOUND);
    }
    if (target.id === user.id) {
      throw new BadRequestException(MESSAGES.BOARDS.ALREADY_OWNER);
    }

    try {
      await this.db.insert(boardMembers).values({
        boardId,
        userId: target.id,
        role: dto.role ?? 'VIEWER',
      });
    } catch {
      throw new ConflictException(MESSAGES.BOARDS.ALREADY_MEMBER);
    }
    return {
      member: { userId: target.id, role: dto.role ?? 'VIEWER', user: target },
    };
  }

  async updateMemberRole(
    boardId: string,
    targetUserId: string,
    user: AuthUser,
    dto: UpdateMemberRoleDto,
  ) {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    this.assertIsOwner(role);

    if (dto.role !== 'OWNER' && (await this.isOwnerOf(boardId, targetUserId))) {
      throw new BadRequestException(MESSAGES.BOARDS.CANNOT_CHANGE_OWNER_ROLE);
    }
    await this.db
      .update(boardMembers)
      .set({ role: dto.role })
      .where(
        and(
          eq(boardMembers.boardId, boardId),
          eq(boardMembers.userId, targetUserId),
        ),
      );
    return { updated: true };
  }

  async removeMember(boardId: string, targetUserId: string, user: AuthUser) {
    const role = await this.getRole(boardId, user.id);
    if (!role) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
    this.assertIsOwner(role);
    if (await this.isOwnerOf(boardId, targetUserId)) {
      throw new BadRequestException(MESSAGES.BOARDS.CANNOT_REMOVE_OWNER);
    }
    await this.db
      .delete(boardMembers)
      .where(
        and(
          eq(boardMembers.boardId, boardId),
          eq(boardMembers.userId, targetUserId),
        ),
      );
    return { removed: true };
  }

  // ── Likes & saves (delegate to counters, verify access first) ──

  async toggleLike(boardId: string, user: AuthUser) {
    await this.requireVisibleBoard(boardId, user);
    const result = await this.countersService.toggleLike(boardId, user.id);
    if (result.likeCount === 0) {
      await this.redis.zrem('trending:boards', boardId).catch(() => undefined);
    }
    return result;
  }

  async toggleSave(boardId: string, user: AuthUser) {
    await this.requireVisibleBoard(boardId, user);
    return this.countersService.toggleSave(boardId, user.id);
  }

  private async didUserSave(boardId: string, userId: string): Promise<boolean> {
    const row = await this.db.query.boardSaves.findFirst({
      where: and(
        eq(boardSaves.boardId, boardId),
        eq(boardSaves.userId, userId),
      ),
    });
    return Boolean(row);
  }

  // ── Helpers ───────────────────────────────────────────────

  private async decorateBoards(list: schema.Board[], viewer?: AuthUser) {
    const ids = list.map((b) => b.id);
    const memberCounts = await this.groupCounts(boardMembers, ids);
    const itemCounts = await this.groupCounts(boardItems, ids);
    const likeCounts = await this.groupCounts(likes, ids);

    return Promise.all(
      list.map(async (board) => ({
        ...board,
        role: await this.getRole(board.id, viewer?.id),
        memberCount: memberCounts.get(board.id) ?? 0,
        itemCount: itemCounts.get(board.id) ?? 0,
        likeCount: likeCounts.get(board.id) ?? 0,
      })),
    );
  }

  private async countRows(
    table: typeof boardMembers | typeof boardItems,
    boardId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.boardId, boardId));
    return Number(row?.count ?? 0);
  }

  private async groupCounts(
    table: typeof boardMembers | typeof boardItems | typeof likes,
    boardIds: string[],
  ): Promise<Map<string, number>> {
    if (boardIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ boardId: table.boardId, count: sql<number>`count(*)` })
      .from(table)
      .where(inArray(table.boardId, boardIds))
      .groupBy(table.boardId);
    return new Map(rows.map((r) => [r.boardId, Number(r.count)]));
  }

  private async requireSection(sectionId: string) {
    const section = await this.db.query.boardSections.findFirst({
      where: eq(boardSections.id, sectionId),
    });
    if (!section) {
      throw new NotFoundException(MESSAGES.BOARDS.SECTION_NOT_FOUND);
    }
    return section;
  }

  private async requireItem(itemId: string) {
    const item = await this.db.query.boardItems.findFirst({
      where: eq(boardItems.id, itemId),
    });
    if (!item) {
      throw new NotFoundException(MESSAGES.BOARDS.ITEM_NOT_FOUND);
    }
    return item;
  }

  private async requireVisibleBoard(boardId: string, user?: AuthUser) {
    const role = await this.getRole(boardId, user?.id);
    const board = await this.db.query.boards.findFirst({
      columns: { id: true, visibility: true },
      where: eq(boards.id, boardId),
    });
    if (!board || (board.visibility === 'PRIVATE' && !role)) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }
  }

  private async isOwnerOf(boardId: string, userId: string): Promise<boolean> {
    const board = await this.db.query.boards.findFirst({
      columns: { ownerId: true },
      where: eq(boards.id, boardId),
    });
    return board?.ownerId === userId;
  }
}
