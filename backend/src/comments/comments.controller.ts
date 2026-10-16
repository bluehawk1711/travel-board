import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.service';
import {
  CommentsService,
  CommentListResult,
  CommentItem,
} from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth('bearer')
@Controller('boards/:boardId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** Public for public boards; private boards require membership (optional auth). */
  @Public()
  @Get()
  list(
    @Param('boardId') boardId: string,
    @CurrentUser() user?: AuthUser,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ): Promise<CommentListResult> {
    return this.commentsService.listByBoard(
      boardId,
      user,
      parseInt(limit, 10) || 50,
      parseInt(offset, 10) || 0,
    );
  }

  @Post()
  add(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentItem> {
    return this.commentsService.add(boardId, user, dto);
  }

  @Delete(':commentId')
  remove(
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ deleted: boolean }> {
    return this.commentsService.remove(commentId, user);
  }
}
