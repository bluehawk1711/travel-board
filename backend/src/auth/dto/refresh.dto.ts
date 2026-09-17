import { IsJWT, IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsJWT()
  @IsOptional()
  refreshToken?: string;
}
