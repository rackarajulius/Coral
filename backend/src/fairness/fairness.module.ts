import { Module } from '@nestjs/common';
import { AdminFairnessController, MyDemographicsController } from './fairness.controller';
import { FairnessService } from './fairness.service';

@Module({
  controllers: [MyDemographicsController, AdminFairnessController],
  providers: [FairnessService],
})
export class FairnessModule {}
