import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Aggregators reject enormous feeds; this is the usual ceiling per pull. */
const MAX_FEED_ITEMS = 5000;

interface FeedJob {
  id: string;
  title: string;
  description: string;
  location: string | null;
  isRemote: boolean;
  employmentType: string;
  category: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  applicationDeadline: Date | null;
  companyName: string | null;
  postedBy: { employerProfile: { companyName: string | null; companyWebsite: string | null } | null } | null;
}

/**
 * Job syndication: an XML feed for aggregators, a sitemap for crawlers, and
 * schema.org JSON-LD for search engines.
 *
 * An employer posting into a board nobody reads is the weakest thing this
 * product can offer them, and syndication is most of what an ATS does about
 * that. All three outputs are built from one query so a job cannot appear in
 * one and not the others.
 */
@Injectable()
export class JobFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Only live, publicly reachable postings.
   *
   * Drafts and archived roles must never syndicate: an aggregator that indexes
   * a job we later un-publish keeps sending people to a dead link, and we do
   * not control how long they cache it.
   */
  private async activeJobs(): Promise<FeedJob[]> {
    return this.prisma.job.findMany({
      where: {
        status: 'active',
        publishedAt: { not: null },
        OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: new Date() } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: MAX_FEED_ITEMS,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        isRemote: true,
        employmentType: true,
        category: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
        publishedAt: true,
        createdAt: true,
        applicationDeadline: true,
        companyName: true,
        postedBy: {
          select: {
            employerProfile: { select: { companyName: true, companyWebsite: true } },
          },
        },
      },
    });
  }

  /**
   * The XML feed aggregators pull.
   *
   * Follows the long-standing `<source><job>` shape that Indeed and most
   * others accept, rather than inventing our own — a feed only has value if
   * somebody else can already read it.
   */
  async buildXmlFeed(): Promise<string> {
    const jobs = await this.activeJobs();
    const base = this.publicUrl();

    const items = jobs
      .map((job) => {
        const company = this.companyName(job);
        return [
          '  <job>',
          `    <title>${cdata(job.title)}</title>`,
          `    <date>${(job.publishedAt ?? job.createdAt).toUTCString()}</date>`,
          `    <referencenumber>${cdata(job.id)}</referencenumber>`,
          `    <url>${cdata(`${base}/jobs?job=${job.id}`)}</url>`,
          `    <company>${cdata(company)}</company>`,
          // Aggregators split location into parts; we hold one free-text
          // field, so it goes in `city` and the rest is left out rather than
          // guessed at. A wrong country is worse than an absent one.
          `    <city>${cdata(job.location ?? '')}</city>`,
          `    <description>${cdata(job.description)}</description>`,
          `    <jobtype>${cdata(job.employmentType)}</jobtype>`,
          job.category ? `    <category>${cdata(job.category)}</category>` : '',
          job.isRemote ? '    <remotetype>Fully remote</remotetype>' : '',
          this.salaryTag(job),
          '  </job>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<source>',
      `  <publisher>${cdata(this.publisherName())}</publisher>`,
      `  <publisherurl>${cdata(base)}</publisherurl>`,
      `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      items,
      '</source>',
    ].join('\n');
  }

  /** A sitemap of every live job, so crawlers can find them without guessing. */
  async buildSitemap(): Promise<string> {
    const jobs = await this.activeJobs();
    const base = this.publicUrl();

    const urls = jobs
      .map((job) =>
        [
          '  <url>',
          `    <loc>${escapeXml(`${base}/jobs?job=${job.id}`)}</loc>`,
          `    <lastmod>${(job.publishedAt ?? job.createdAt).toISOString()}</lastmod>`,
          '    <changefreq>daily</changefreq>',
          '  </url>',
        ].join('\n'),
      )
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n');
  }

  /**
   * schema.org JobPosting for one job.
   *
   * Built server-side and returned as data, because the front end is a
   * client-rendered SPA: markup injected after page load is not reliably
   * indexed for Google Jobs. This exists so the payload is correct and ready
   * the moment job pages are server-rendered or pre-rendered — that change is
   * what actually turns this into search traffic.
   */
  async buildJsonLd(jobId: string): Promise<Record<string, unknown> | null> {
    const job = (await this.prisma.job.findFirst({
      where: { id: jobId, status: 'active', publishedAt: { not: null } },
      select: {
        id: true, title: true, description: true, location: true, isRemote: true,
        employmentType: true, category: true, salaryMin: true, salaryMax: true,
        salaryCurrency: true, salaryPeriod: true, publishedAt: true, createdAt: true,
        applicationDeadline: true, companyName: true,
        postedBy: {
          select: { employerProfile: { select: { companyName: true, companyWebsite: true } } },
        },
      },
    })) as FeedJob | null;
    if (!job) return null;

    const website = job.postedBy?.employerProfile?.companyWebsite ?? undefined;

    const payload: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description,
      datePosted: (job.publishedAt ?? job.createdAt).toISOString(),
      employmentType: job.employmentType.toUpperCase().replace(/[\s-]+/g, '_'),
      hiringOrganization: {
        '@type': 'Organization',
        name: this.companyName(job),
        ...(website ? { sameAs: website } : {}),
      },
      /** Google requires this to be absent, not empty, when unknown. */
      ...(job.applicationDeadline
        ? { validThrough: job.applicationDeadline.toISOString() }
        : {}),
    };

    if (job.location) {
      payload.jobLocation = {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: job.location },
      };
    }
    if (job.isRemote) {
      payload.jobLocationType = 'TELECOMMUTE';
    }

    // Omitted entirely when the employer did not disclose one. An estimated
    // salary would be a number we invented appearing in a search result.
    const salary = this.salaryValue(job);
    if (salary) payload.baseSalary = salary;

    return payload;
  }

  /* --------------------------------- helpers -------------------------------- */

  private salaryValue(job: FeedJob) {
    if (job.salaryMin == null && job.salaryMax == null) return null;
    const unit = (job.salaryPeriod ?? 'year').toLowerCase();
    const unitText =
      unit.startsWith('hour') ? 'HOUR' : unit.startsWith('month') ? 'MONTH' : 'YEAR';
    return {
      '@type': 'MonetaryAmount',
      currency: job.salaryCurrency.toUpperCase(),
      value: {
        '@type': 'QuantitativeValue',
        ...(job.salaryMin != null ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax != null ? { maxValue: job.salaryMax } : {}),
        unitText,
      },
    };
  }

  private salaryTag(job: FeedJob): string {
    if (job.salaryMin == null && job.salaryMax == null) return '';
    const range =
      job.salaryMin != null && job.salaryMax != null
        ? `${job.salaryMin}-${job.salaryMax}`
        : String(job.salaryMin ?? job.salaryMax);
    return `    <salary>${cdata(`${range} ${job.salaryCurrency.toUpperCase()}`)}</salary>`;
  }

  /**
   * The employer profile's name wins over the job's own field, which is an
   * admin override used when no employer account is linked.
   */
  private companyName(job: FeedJob): string {
    return (
      job.postedBy?.employerProfile?.companyName?.trim() ||
      job.companyName?.trim() ||
      'Confidential'
    );
  }

  private publicUrl(): string {
    return this.config
      .get<string>('PUBLIC_APP_URL', 'http://localhost:8080')
      .replace(/\/+$/, '');
  }

  private publisherName(): string {
    return this.config.get<string>('PUBLIC_APP_NAME', 'Coral');
  }
}

/** CDATA is the only safe way to carry job descriptions, which contain markup. */
function cdata(value: string): string {
  // `]]>` inside the content would close the section early; split it so the
  // parser never sees the sequence.
  return `<![CDATA[${(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
