import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PlacesService, PlaceResult } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { PhotoPlacesDto } from './dto/photo-places.dto';

@ApiTags('places')
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

  /**
   * Stream a place photo so the Google key stays server-side. Clients cache
   * to disk via the long Cache-Control; the API keeps a small hot cache.
   */
  @Public()
  @Get('photo')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async photo(@Query() dto: PhotoPlacesDto, @Res() res: Response) {
    const photo = await this.placesService.getPhoto(dto.name, dto.w ?? 800);
    res.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    });
    res.send(photo.buffer).end();
  }
}
