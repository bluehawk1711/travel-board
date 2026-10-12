import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { PushPlatform } from '../push.service';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsIn(['EXPO', 'FCM', 'WEB_PUSH'])
  platform?: PushPlatform;
}

export class UnregisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
