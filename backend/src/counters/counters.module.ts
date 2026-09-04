import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '../db/dbProvider';
import { CountersService } from './counters.service';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
