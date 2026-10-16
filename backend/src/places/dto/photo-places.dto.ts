import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PhotoPlacesDto {
  /**
   * Google Places photo resource name, e.g. `places/…/photos/…`. Validated
   * against a strict pattern in the service before it is used in a URL.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  /** Rendered width cap in pixels (Google scales down to fit). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(2048)
  w?: number;
}
