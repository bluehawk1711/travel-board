import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

/**
 * Mirrors the `theme_mode` Postgres enum and `THEME_MODES` in the repo-level
 * `shared/index.ts` (backend can't import across the package root without
 * changing nest build's dist layout — keep the three lists in sync).
 */
const THEME_MODES = ['SYSTEM', 'LIGHT', 'DARK'] as const;

/**
 * Per-user preferences. All fields optional — PATCH semantics; the service
 * upserts the row on first access.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(THEME_MODES)
  themeMode?: (typeof THEME_MODES)[number];

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailUpdates?: boolean;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
