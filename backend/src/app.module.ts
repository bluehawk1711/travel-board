import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { KeyvCacheableMemory } from 'cacheable';
import { Redis } from '@upstash/redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlacesModule } from './places/places.module';
import { AuthModule } from './auth/auth.module';
import { BoardsModule } from './boards/boards.module';
import { CountersModule } from './counters/counters.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { CommentsModule } from './comments/comments.module';
import { FollowsModule } from './follows/follows.module';
import { ChatModule } from './chat/chat.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './common/redis/redis.module';
import { REDIS_CLIENT } from './common/redis/redis.constants';
import { UpstashKeyvStore } from './common/cache/upstash-keyv.store';
import { ThrottlerStorageUpstash } from './common/cache/redis.throttler-storage';

/** L1 in-memory tier: short TTL + LRU bound so memory stays small. */
const CACHE_L1_TTL_MS = 60_000;
const CACHE_L1_LRU_SIZE = 5_000;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      imports: [ConfigService],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino/file', options: { destination: 1 } }
              : undefined,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Keyv owns serialization, so the store client must return raw strings.
        const redis = new Redis({
          url: configService.getOrThrow('UPSTASH_REDIS_REST_URL'),
          token: configService.getOrThrow('UPSTASH_REDIS_REST_TOKEN'),
          automaticDeserialization: false,
        });
        return {
          stores: [
            new KeyvCacheableMemory({
              ttl: CACHE_L1_TTL_MS,
              lruSize: CACHE_L1_LRU_SIZE,
            }),
            new UpstashKeyvStore(redis),
          ],
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageUpstash(redis),
      }),
    }),
    PlacesModule,
    AuthModule,
    CountersModule,
    BoardsModule,
    DiscoveryModule,
    CommentsModule,
    FollowsModule,
    ChatModule,
    UploadsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
