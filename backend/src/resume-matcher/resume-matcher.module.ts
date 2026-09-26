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
import { CompanyResearchModule } from './company-research/company-research.module';

@Module({
  // SeekerEntitlementsModule: web searches and AI assists are metered.
  imports: [AiModule, CompanyResearchModule, SeekerEntitlementsModule],
  controllers: [ResumeMatcherController],
  providers: [
    ResumeMatcherService,
    PlatformJobSource,
    AdzunaJobSource,
    JSearchJobSource,
    GreenhouseJobSource,
    LeverJobSource,
  ],
})
export class ResumeMatcherModule {}
