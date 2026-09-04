import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/dbProvider';
import { BoardsModule } from '../boards/boards.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [DrizzleModule, BoardsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
