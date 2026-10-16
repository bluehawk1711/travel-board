import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.service';
import { DiscoveryService } from './discovery.service';
import type { ExploreResult, FeedSort } from './discovery.service';

@ApiTags('explore')
@Controller('explore')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Public explore feed (Pinterest-style masonry grid data). Pass `?q=` to
   * search public boards by title or destination (features.md §3: search is
   * Must; results stay cache-free since queries are arbitrary).
   */
  @Public()
  @Get()
  explore(
    @Query('sort') sort: FeedSort = 'newest',
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
    @Query('q') q?: string,
  ): Promise<ExploreResult> {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const parsedSort: FeedSort = sort === 'trending' ? 'trending' : 'newest';
    return this.discoveryService.explore(
      parsedSort,
      parsedLimit,
      parsedOffset,
      q,
    );
  }

  /** Boards from the users I follow (personal, auth-only feed). */
  @Get('following')
  following(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ): Promise<ExploreResult> {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    return this.discoveryService.followingFeed(
      user.id,
      parsedLimit,
      parsedOffset,
    );
  }
}
