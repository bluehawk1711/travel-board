import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';
import { MESSAGES } from '../common/messages';
import {
  NotificationListResult,
  NotificationsService,
} from './notifications.service';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit = '30',
    @Query('offset') offset = '0',
  ): Promise<NotificationListResult> {
    return this.notificationsService.listForUser(
      user.id,
      parseInt(limit, 10) || 30,
      parseInt(offset, 10) || 0,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser): Promise<{ unreadCount: number }> {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch('read')
  markRead(
    @Body() dto: MarkNotificationsReadDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number; message: string }> {
    return this.notificationsService
      .markRead(user.id, dto.ids)
      .then((result) => ({ ...result, message: MESSAGES.NOTIFICATIONS.READ }));
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number; message: string }> {
    return this.notificationsService
      .markAllRead(user.id)
      .then((result) => ({ ...result, message: MESSAGES.NOTIFICATIONS.READ }));
  }
}
