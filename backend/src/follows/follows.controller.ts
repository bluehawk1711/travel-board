import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.service';
import {
  FollowListResult,
  FollowsService,
  FollowToggleResult,
  FollowUser,
} from './follows.service';

@Controller()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  // ── Follow / unfollow users ───────────────────────────────
  @Post('users/:userId/follow')
  followUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FollowToggleResult> {
    return this.followsService.followUser(user, userId);
  }

  @Delete('users/:userId/follow')
  unfollowUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FollowToggleResult> {
    return this.followsService.unfollowUser(user, userId);
  }

  // ── Follow / unfollow boards ──────────────────────────────
  @Post('boards/:boardId/follow')
  followBoard(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FollowToggleResult> {
    return this.followsService.followBoard(user, boardId);
  }

  @Delete('boards/:boardId/follow')
  unfollowBoard(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<FollowToggleResult> {
    return this.followsService.unfollowBoard(user, boardId);
  }

  // ── Lists (public) ────────────────────────────────────────
  @Public()
  @Get('users/:userId/followers')
  userFollowers(
    @Param('userId') userId: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ): Promise<FollowListResult<FollowUser>> {
    return this.followsService.userFollowers(
      userId,
      parseInt(limit, 10) || 20,
      parseInt(offset, 10) || 0,
    );
  }

  @Public()
  @Get('users/:userId/following')
  userFollowing(
    @Param('userId') userId: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ): Promise<FollowListResult<FollowUser>> {
    return this.followsService.userFollowing(
      userId,
      parseInt(limit, 10) || 20,
      parseInt(offset, 10) || 0,
    );
  }

  /** Public for public boards; private boards require membership. */
  @Public()
  @Get('boards/:boardId/followers')
  boardFollowers(
    @Param('boardId') boardId: string,
    @CurrentUser() user?: AuthUser,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ): Promise<FollowListResult<FollowUser>> {
    return this.followsService.boardFollowers(
      boardId,
      user,
      parseInt(limit, 10) || 20,
      parseInt(offset, 10) || 0,
    );
  }
}
