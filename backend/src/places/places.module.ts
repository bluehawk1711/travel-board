import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  // PlacesService reads GOOGLE_PLACES_API_KEY via ConfigService, so the
  // config module must be importable here even though it is global in AppModule.
  imports: [ConfigModule],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
