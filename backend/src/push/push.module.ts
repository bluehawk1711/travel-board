import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/dbProvider';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [DrizzleModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
