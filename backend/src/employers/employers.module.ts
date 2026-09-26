import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { NextActionsService } from './next-actions.service';
import { OnboardingService } from './onboarding.service';
import { EmployerVerificationService } from './employer-verification.service';

@Module({
  imports: [StorageModule, AnalyticsModule],
  controllers: [EmployersController],
  providers: [EmployersService, NextActionsService, OnboardingService, EmployerVerificationService],
  exports: [EmployersService, EmployerVerificationService],
})
export class EmployersModule {}
