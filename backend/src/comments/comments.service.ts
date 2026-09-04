import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_CONNECTION } from '../db/dbProvider';
import * as schema from '../db/schema';
import { boards, comments, users } from '../db/schema';
import { MESSAGES } from '../common/messages';
import { BoardsService } from '../boards/boards.service';
import type { AuthUser } from '../auth/auth.service';
import { CreateCommentDto } from './dto/create-comment.dto';

export interface CommentItem {
  id: string;
  boardId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

export interface CommentListResult {
  items: CommentItem[];
  total: number;
}

@Injectable()
export class CommentsService {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly boardsService: BoardsService,
  ) {}

  async listByBoard(
    boardId: string,
    viewer: AuthUser | undefined,
    limit = 50,
    offset = 0,
  ): Promise<CommentListResult> {
    if (!(await this.boardsService.canView(boardId, viewer?.id))) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }

    const parsedLimit = Math.min(Math.max(limit, 1), 100);
    const parsedOffset = Math.max(offset, 0);

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          id: comments.id,
          boardId: comments.boardId,
          body: comments.body,
          createdAt: comments.createdAt,
          authorId: users.id,
          authorName: users.name,
          authorAvatar: users.avatarUrl,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.boardId, boardId))
        .orderBy(desc(comments.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.boardId, boardId)),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        boardId: row.boardId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        author: {
          id: row.authorId,
          name: row.authorName,
          avatarUrl: row.authorAvatar,
        },
      })),
      total: Number(totalRow[0]?.total ?? 0),
    };
  }

  async add(
    boardId: string,
    user: AuthUser,
    dto: CreateCommentDto,
  ): Promise<CommentItem> {
    if (!(await this.boardsService.canView(boardId, user.id))) {
      throw new NotFoundException(MESSAGES.BOARDS.NOT_FOUND);
    }

    const [comment] = await this.db
      .insert(comments)
      .values({ boardId, userId: user.id, body: dto.body })
      .returning();

    return {
      id: comment.id,
      boardId: comment.boardId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    };
  }

  /** The comment author or the board owner may delete a comment. */
  async remove(
    commentId: string,
    user: AuthUser,
  ): Promise<{ deleted: boolean }> {
    const comment = await this.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });
    if (!comment) {
      throw new NotFoundException(MESSAGES.COMMENTS.NOT_FOUND);
    }

    const board = await this.db.query.boards.findFirst({
      columns: { ownerId: true },
      where: eq(boards.id, comment.boardId),
    });
    const canDelete = comment.userId === user.id || board?.ownerId === user.id;
    if (!canDelete) {
      throw new ForbiddenException(MESSAGES.COMMENTS.NOT_AUTHOR);
    }

    await this.db.delete(comments).where(and(eq(comments.id, commentId)));
    return { deleted: true };
  }
}
