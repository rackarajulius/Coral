import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { ResumeMatcherController } from './resume-matcher.controller';
import { SeekerEntitlementsModule } from '../seeker-entitlements/seeker-entitlements.module';
import { ResumeMatcherService } from './resume-matcher.service';
import { PlatformJobSource } from './job-sources/platform.source';
import { AdzunaJobSource } from './job-sources/adzuna.source';
import { JSearchJobSource } from './job-sources/jsearch.source';
import { GreenhouseJobSource } from './job-sources/greenhouse.source';
import { LeverJobSource } from './job-sources/lever.source';
import { AshbyJobSource } from './job-sources/ashby.source';
import { CompanyResearchModule } from './company-research/company-research.module';
import { StorageModule } from '../storage/storage.module';
import { CompanyLogoService } from './company-logos.service';
import { LocationsModule } from '../locations/locations.module';
import { RoleTranslationService } from './role-translation.service';

@Module({
  // SeekerEntitlementsModule: web searches and AI assists are metered.
  // StorageModule: employer logos are kept in our own storage.
  // LocationsModule: a chosen city decides which countries are searched.
  imports: [AiModule, CompanyResearchModule, SeekerEntitlementsModule, StorageModule, LocationsModule],
  controllers: [ResumeMatcherController],
  providers: [
    ResumeMatcherService,
    PlatformJobSource,
    AdzunaJobSource,
    JSearchJobSource,
    GreenhouseJobSource,
    LeverJobSource,
    AshbyJobSource,
    CompanyLogoService,
    RoleTranslationService,
  ],
  // Job alerts search the web through the matcher, so both find jobs the same way.
  exports: [ResumeMatcherService],
})
export class ResumeMatcherModule {}
