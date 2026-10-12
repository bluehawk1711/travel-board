import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/dbProvider';
import { BoardsModule } from '../boards/boards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [DrizzleModule, BoardsModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
