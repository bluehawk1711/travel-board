import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/dbProvider';
import { PushModule } from '../push/push.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [DrizzleModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
