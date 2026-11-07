import { Module } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { LocationsController } from './locations.controller';

@Module({
  controllers: [LocationsController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class LocationsModule {}
