import { Module } from '@nestjs/common';
import { AiModule } from '../../services/ai/ai.module';
import { CompanyResearchService } from './company-research.service';
import { FirecrawlClient } from './firecrawl.client';

/**
 * Company research is used by both the resume matcher and the job details
 * page, so it lives in its own module rather than being pulled in via the
 * whole ResumeMatcherModule (which drags every job source with it).
 */
@Module({
  imports: [AiModule],
  providers: [CompanyResearchService, FirecrawlClient],
  exports: [CompanyResearchService],
})
export class CompanyResearchModule {}
