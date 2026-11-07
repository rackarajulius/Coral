import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { FreelancersController } from './freelancers.controller';
import { FreelancersService } from './freelancers.service';

@Module({
  // LocationsModule: reads where a provider is based, for the directory's location filter.
  imports: [LocationsModule],
  controllers: [FreelancersController],
  providers: [FreelancersService],
  exports: [FreelancersService],
})
export class FreelancersModule {}

