import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { AppService } from './app.service';

@Module({
  imports: [CacheModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
