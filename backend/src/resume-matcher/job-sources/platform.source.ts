import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CandidateJob, JobSource, SearchInput } from './types';

const CURRENCY: Record<string, string> = { USD: '$', CAD: 'C$', EUR: '€', GBP: '£' };

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
    if (location.trim()) {
      and.push({ location: { contains: location.trim(), mode: 'insensitive' } });
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
        location: true,
        isRemote: true,
        description: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return jobs.map((j) => ({
      id: `platform:${j.id}`,
      title: j.title,
      company: j.companyName?.trim() || 'Company',
      location: j.location?.trim() || (j.isRemote ? 'Remote' : ''),
      description: j.description ?? '',
      url: j.slug ? `/jobs?job=${j.slug}` : '/jobs',
      salary: this.formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency),
      source: this.name,
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
