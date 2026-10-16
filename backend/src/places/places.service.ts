import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { MESSAGES } from '../common/messages';

/** A fetched Places photo: raw bytes + the upstream content type. */
export interface PlacePhoto {
  buffer: Buffer;
  contentType: string;
}

/** 24h — Places API responses are immutable and billed per call. */
const PLACES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
].join(',');

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  location: { lat: number; lng: number } | null;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  photoName: string | null;
}

interface SearchOptions {
  lat?: number;
  lng?: number;
  radius?: number;
}

interface GooglePlaceRaw {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{ name?: string }>;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    // Server-side only: the API key must never reach web/mobile clients.
    this.apiKey = this.configService.getOrThrow('GOOGLE_PLACES_API_KEY');
  }

  /** Cache-aside: read Redis-backed cache, on miss call Google and populate (24h TTL). */
  async searchText(
    query: string,
    options: SearchOptions = {},
  ): Promise<PlaceResult[]> {
    const cacheKey = this.cacheKey(query, options);

    const cached = await this.cacheManager.get<PlaceResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await this.fetchFromGoogle(query, options);
    await this.cacheManager.set(cacheKey, results, PLACES_CACHE_TTL_MS);
    return results;
  }

  private async fetchFromGoogle(
    query: string,
    options: SearchOptions,
  ): Promise<PlaceResult[]> {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const body: Record<string, unknown> = { textQuery: query };

    if (options.lat != null && options.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: options.lat, longitude: options.lng },
          radius: options.radius ?? 1_000,
        },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Google Places API error: ${response.status} ${response.statusText} — ${detail.slice(0, 500)}`,
      );
      throw new HttpException(
        MESSAGES.PLACES.SEARCH_FAILED,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = (await response.json()) as { places?: GooglePlaceRaw[] };
    return (data.places ?? []).map((place) => ({
      placeId: place.id,
      name: place.displayName?.text ?? 'Unknown place',
      formattedAddress: place.formattedAddress ?? null,
      location:
        place.location?.latitude != null && place.location.longitude != null
          ? { lat: place.location.latitude, lng: place.location.longitude }
          : null,
      types: place.types ?? [],
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      photoName: place.photos?.[0]?.name ?? null,
    }));
  }

  private cacheKey(query: string, options: SearchOptions): string {
    const base = `places:text:${encodeURIComponent(query.trim().toLowerCase())}`;
    if (options.lat != null && options.lng != null) {
      return `${base}:${options.lat},${options.lng}:${options.radius ?? 1_000}`;
    }
    return base;
  }

  // ── Photo proxy ────────────────────────────────────────────
  // Photos are fetched server-side so the Places key never reaches clients.
  // Resolved bytes live in a small bounded in-process cache (hot photos only)
  // and are served to clients with a long Cache-Control so the mobile/web
  // image layers cache to disk — this keeps binary blobs out of Upstash Redis
  // (§6: never store unbounded data) while still absorbing repeat views.

  private static readonly PHOTO_CACHE_MAX_ENTRIES = 64;
  private readonly photoCache = new Map<string, PlacePhoto>();

  /** Photo resource names look like `places/…/photos/…` — reject anything else. */
  private static readonly PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

  async getPhoto(photoName: string, maxWidthPx = 800): Promise<PlacePhoto> {
    if (!PlacesService.PHOTO_NAME_RE.test(photoName)) {
      throw new HttpException(MESSAGES.PLACES.PHOTO_INVALID, HttpStatus.BAD_REQUEST);
    }

    const width = Math.min(Math.max(Math.round(maxWidthPx), 16), 2048);
    const cacheKey = `${photoName}@${width}`;
    const cached = this.photoCache.get(cacheKey);
    if (cached) {
      // Refresh LRU recency.
      this.photoCache.delete(cacheKey);
      this.photoCache.set(cacheKey, cached);
      return cached;
    }

    const url =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxWidthPx=${width}&key=${this.apiKey}`;

    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Places photo error: ${response.status} ${response.statusText} — ${detail.slice(0, 300)}`,
      );
      throw new HttpException(
        MESSAGES.PLACES.PHOTO_FAILED,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    const photo: PlacePhoto = { buffer, contentType };

    // Bounded LRU: drop the oldest entry once at capacity.
    if (this.photoCache.size >= PlacesService.PHOTO_CACHE_MAX_ENTRIES) {
      const oldest = this.photoCache.keys().next().value;
      if (oldest !== undefined) this.photoCache.delete(oldest);
    }
    this.photoCache.set(cacheKey, photo);
    return photo;
  }
}
