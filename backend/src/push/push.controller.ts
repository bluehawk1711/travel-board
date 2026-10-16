import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';
import { MESSAGES } from '../common/messages';
import { PushService } from './push.service';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from './dto/push-token.dto';

@ApiTags('push')
@ApiBearerAuth('bearer')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('tokens')
  registerToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ registered: boolean; message: string }> {
    return this.pushService
      .registerToken(user.id, dto.token, dto.platform ?? 'EXPO')
      .then((result) => ({
        ...result,
        message: MESSAGES.PUSH.TOKEN_REGISTERED,
      }));
  }

  @Delete('tokens')
  unregisterToken(
    @Body() dto: UnregisterPushTokenDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ unregistered: boolean; message: string }> {
    return this.pushService
      .unregisterToken(user.id, dto.token)
      .then((result) => ({
        ...result,
        message: MESSAGES.PUSH.TOKEN_REMOVED,
      }));
  }
}
