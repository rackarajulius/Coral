import { Module } from '@nestjs/common';
import { DistributionController } from './distribution.controller';
import { JobFeedService } from './job-feed.service';

/** Public job syndication: XML feed, sitemap, and schema.org payloads. */
@Module({
  controllers: [DistributionController],
  providers: [JobFeedService],
  exports: [JobFeedService],
})
export class DistributionModule {}
