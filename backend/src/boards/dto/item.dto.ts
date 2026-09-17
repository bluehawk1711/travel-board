import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const BOARD_ITEM_TYPES = [
  'PLACE',
  'IMAGE',
  'NOTE',
  'LINK',
  'RESTAURANT',
  'HOTEL',
  'ACTIVITY',
] as const;

export class CreateItemDto {
  @IsEnum(BOARD_ITEM_TYPES)
  type!: (typeof BOARD_ITEM_TYPES)[number];

  @IsUUID()
  sectionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  position?: number;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  position?: number;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}
