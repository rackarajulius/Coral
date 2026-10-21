import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CandidateJob, JobSource, SearchInput, cityOf, employmentTypeOf, isoDate, yearlyPay } from './types';

const CURRENCY: Record<string, string> = { USD: '$', CAD: 'C$', EUR: '€', GBP: '£' };

/** An uploaded logo's address, or undefined for blanks and legacy inline data. */
function webImage(url: string | null | undefined): string | undefined {
  return url && /^https:\/\//.test(url.trim()) ? url.trim() : undefined;
}

/** Jobs from our own platform. Always enabled — no external key needed. */
@Injectable()
export class PlatformJobSource implements JobSource {
  readonly name = 'platform' as const;

  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return true;
  }

  async search({ query, location, limit }: SearchInput): Promise<CandidateJob[]> {
    const terms = query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 6);

    const and: Prisma.JobWhereInput[] = [{ status: 'active' }];
    // "Toronto, ON" from the location box: a posting saying "Toronto, Ontario"
    // matches on the city, not the whole label.
    if (cityOf(location)) {
      and.push({ location: { contains: cityOf(location), mode: 'insensitive' } });
    }
    if (terms.length > 0) {
      and.push({
        OR: [
          ...terms.flatMap((t) => [
            { title: { contains: t, mode: 'insensitive' } } as Prisma.JobWhereInput,
            { description: { contains: t, mode: 'insensitive' } } as Prisma.JobWhereInput,
          ]),
          { skills: { hasSome: terms } },
        ],
      });
    }

    const jobs = await this.prisma.job.findMany({
      where: { AND: and },
      select: {
        id: true,
        title: true,
        slug: true,
        companyName: true,
        companyLogo: true,
        postedBy: { select: { employerProfile: { select: { companyName: true, companyLogo: true } } } },
        location: true,
        isRemote: true,
        isHybrid: true,
        employmentType: true,
        publishedAt: true,
        createdAt: true,
        salaryPeriod: true,
        description: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    // Name and logo resolve as on the job board: the job's own (set by an admin
    // posting for someone) first, then the employer's profile. The name used
    // to stop at the job's own, which employers never set, so their matches
    // said "Company". The poster's photo is not used as a logo here: a
    // recruiter's face would pass for the company's mark.
    return jobs.map((j) => ({
      id: `platform:${j.id}`,
      title: j.title,
      company: j.companyName?.trim() || j.postedBy?.employerProfile?.companyName?.trim() || 'Company',
      logoUrl: webImage(j.companyLogo) ?? webImage(j.postedBy?.employerProfile?.companyLogo),
      location: j.location?.trim() || (j.isRemote ? 'Remote' : ''),
      description: j.description ?? '',
      url: j.slug ? `/jobs?job=${j.slug}` : '/jobs',
      salary: this.formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency),
      source: this.name,
      postedAt: isoDate(j.publishedAt ?? j.createdAt),
      employmentType: employmentTypeOf(j.employmentType),
      // Employers here choose remote, hybrid or neither, so neither means on-site.
      workplace: j.isRemote ? ('remote' as const) : j.isHybrid ? ('hybrid' as const) : ('onsite' as const),
      yearlyPay: yearlyPay(j.salaryMin, j.salaryMax, j.salaryPeriod, j.salaryCurrency),
    }));
  }

  private formatSalary(min: number | null, max: number | null, currency: string | null): string | undefined {
    if (!min && !max) return undefined;
    const sym = CURRENCY[(currency ?? 'USD').toUpperCase()] ?? '';
    const k = (n: number) => (n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`);
    if (min && max) return `${k(min)}–${k(max)}`;
    return k((min ?? max) as number);
  }
}
