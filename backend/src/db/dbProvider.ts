import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import * as schema from './schema';

export const PG_CONNECTION = 'PG_CONNECTION';

@Module({
  providers: [
    {
      provide: PG_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString: string =
          configService.get('DATABASE_URL') || '';
        const pool = new Pool({ connectionString });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [PG_CONNECTION],
})
export class DrizzleModule {}
