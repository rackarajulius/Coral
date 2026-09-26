import { Controller, Get, Header, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { JobFeedService } from './job-feed.service';

/**
 * Public syndication endpoints.
 *
 * All unauthenticated by design — an aggregator or crawler has no account, and
 * everything served here is already public on the job board. Nothing employer-
 * private is reachable from this controller.
 *
 * Everything sits under `/feeds` rather than `/jobs`, where `jobs/:id` parses
 * its parameter as a UUID and answered "feed.xml" with a validation error.
 * Depending on module registration order to resolve that would have been a
 * collision waiting to come back.
 */
@Controller()
export class DistributionController {
  constructor(private readonly feed: JobFeedService) {}

  /**
   * The XML feed aggregators pull on a schedule.
   *
   * Cached for an hour: aggregators poll far more often than jobs change, and
   * rebuilding the whole feed per request is a needless full table scan.
   */
  @Public()
  @Get('feeds/jobs.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async xmlFeed(@Res() res: Response) {
    res.send(await this.feed.buildXmlFeed());
  }

  @Public()
  @Get('feeds/sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemap(@Res() res: Response) {
    res.send(await this.feed.buildSitemap());
  }

  /**
   * schema.org JobPosting for one job.
   *
   * Returned as JSON rather than embedded in a page because the front end is a
   * client-rendered SPA. Search engines will only credit this once job pages
   * are server-rendered; until then it is correct and unused, which is the
   * honest state of it.
   */
  @Public()
  @Get('feeds/jobs/:id/jsonld')
  @Header('Content-Type', 'application/ld+json; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async jsonLd(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const payload = await this.feed.buildJsonLd(id);
    if (!payload) throw new NotFoundException('Job not found');
    // Written straight to the response so the global { success, data } wrapper
    // does not apply. A JSON-LD document nested under a "data" key is not a
    // JSON-LD document, and nothing consuming schema.org would read it.
    res.send(JSON.stringify(payload));
  }
}
