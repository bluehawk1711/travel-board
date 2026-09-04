import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { REDIS_CLIENT } from './redis.constants';

export const REDIS_CLIENT_PROVIDER = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis =>
    new Redis({
      url: configService.getOrThrow('UPSTASH_REDIS_REST_URL'),
      token: configService.getOrThrow('UPSTASH_REDIS_REST_TOKEN'),
    }),
};

@Global()
@Module({
  providers: [REDIS_CLIENT_PROVIDER],
  exports: [REDIS_CLIENT_PROVIDER],
})
export class RedisModule {}
