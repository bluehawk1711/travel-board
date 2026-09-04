import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PlacesService, PlaceResult } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  /**
   * Public places search proxied through the API so the Google Places key
   * stays server-side. Tighter rate limit: every miss bills the Places API.
   */
  @Public()
  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@Query() dto: SearchPlacesDto): Promise<PlaceResult[]> {
    return this.placesService.searchText(dto.q, {
      lat: dto.lat,
      lng: dto.lng,
      radius: dto.radius,
    });
  }
}
