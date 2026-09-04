import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DiscoveryService } from './discovery.service';
import type { ExploreResult, FeedSort } from './discovery.service';

@Controller('explore')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /** Public explore feed (Pinterest-style masonry grid data). */
  @Public()
  @Get()
  explore(
    @Query('sort') sort: FeedSort = 'newest',
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ): Promise<ExploreResult> {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const parsedSort: FeedSort = sort === 'trending' ? 'trending' : 'newest';
    return this.discoveryService.explore(parsedSort, parsedLimit, parsedOffset);
  }
}
