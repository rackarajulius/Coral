import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FreelancerProfile, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { providerProfileReadiness, safeProviderUrl } from './provider-profile-policy';
import { ProviderDirectoryQueryDto } from './dto/provider-directory-query.dto';
import {
  PROVIDER_AVAILABILITY, PROVIDER_CATEGORIES, PROVIDER_WORK_PREFERENCES,
  UpdateFreelancerProfileDto,
} from './dto/update-freelancer-profile.dto';

// Intentionally no contact fields, recruiting relations, verification badges or
// legacy self-entered statistics. This is also the database projection for reads.
const PUBLIC_SELECT = {
  id: true, userId: true, category: true, headline: true, title: true, summary: true,
  skills: true, expertise: true, hourlyRate: true, currency: true, country: true,
  city: true, timezone: true, availableForRemote: true, availability: true,
  hoursPerWeek: true, portfolioUrl: true, githubUrl: true, linkedinUrl: true,
  workPreferences: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
} satisfies Prisma.FreelancerProfileSelect;

const OWNER_SELECT = {
  ...PUBLIC_SELECT, providerEnabled: true, publicPreviewEnabled: true,
  completedProjects: true, rating: true, totalEarnings: true,
} satisfies Prisma.FreelancerProfileSelect;

type PublicProfileRecord = Prisma.FreelancerProfileGetPayload<{ select: typeof PUBLIC_SELECT }>;

const WRITABLE_FIELDS = [
  'providerEnabled', 'publicPreviewEnabled', 'category', 'workPreferences',
  'headline', 'summary', 'title', 'skills', 'expertise', 'hourlyRate', 'currency',
  'country', 'city', 'timezone', 'availableForRemote', 'availability', 'hoursPerWeek',
  'portfolioUrl', 'githubUrl', 'linkedinUrl',
] as const;
type WritableData = Partial<Pick<FreelancerProfile, (typeof WRITABLE_FIELDS)[number]>>;

function normalizedLabels(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = value.toLocaleLowerCase('en');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Treat search punctuation literally, including SQL LIKE's escape character. */
function literalSearchPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

@Injectable()
export class FreelancersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(userId: string) {
    const profile = await this.prisma.freelancerProfile.findFirst({
      where: { ...this.publicVisibilityWhere(), userId }, select: PUBLIC_SELECT,
    });
    if (!profile || !providerProfileReadiness(profile).ready) {
      throw new NotFoundException('Provider profile not available');
    }
    return this.serializePublic(profile);
  }

  async listPublicProfiles(query: ProviderDirectoryQueryDto) {
    const limit = query.limit ?? 12;
    const search = query.q?.trim();
    if (!Number.isInteger(limit) || limit < 1 || limit > 24 || (search?.length ?? 0) > 100) {
      throw new BadRequestException('Provider search exceeds its allowed bounds');
    }
    const pattern = search ? literalSearchPattern(search) : null;
    const escape = '\\';
    // PostgreSQL array labels retain the professional's spelling. Match them
    // case-insensitively in SQL rather than loading private/all profiles into
    // memory. Only bounded, already public IDs leave this lookup.
    const matched = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT profile.id FROM freelancer_profiles AS profile
      JOIN users AS account ON account.id = profile.user_id
      WHERE profile.provider_enabled = true AND profile.public_preview_enabled = true
        AND account.status = 'ACTIVE' AND account.role IN ('JOB_SEEKER', 'FREELANCER')
        AND profile.category IN (${Prisma.join([...PROVIDER_CATEGORIES])})
        AND length(btrim(coalesce(profile.headline, ''))) >= 3
        AND length(btrim(coalesce(profile.summary, ''))) >= 30
        AND EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE length(btrim(label)) > 0)
        AND (coalesce(profile.portfolio_url, '') <> '' OR coalesce(profile.github_url, '') <> '')
        ${query.category ? Prisma.sql`AND profile.category = ${query.category}` : Prisma.empty}
        ${query.cursor ? Prisma.sql`AND profile.id > ${query.cursor}` : Prisma.empty}
        ${pattern ? Prisma.sql`AND (
          profile.headline ILIKE ${pattern} ESCAPE ${escape}
          OR profile.title ILIKE ${pattern} ESCAPE ${escape}
          OR profile.summary ILIKE ${pattern} ESCAPE ${escape}
          OR account.display_name ILIKE ${pattern} ESCAPE ${escape}
          OR account.first_name ILIKE ${pattern} ESCAPE ${escape}
          OR account.last_name ILIKE ${pattern} ESCAPE ${escape}
          OR EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE label ILIKE ${pattern} ESCAPE ${escape})
        )` : Prisma.empty}
      ORDER BY profile.id ASC LIMIT ${limit + 1}
    `);
    const pageIds = matched.slice(0, limit).map((record) => record.id);
    if (!pageIds.length) return { items: [], nextCursor: null };
    // Recheck consent/status on the projection, including withdrawal between
    // the ID lookup and read. The cursor tracks the bounded scanned page.
    const records = await this.prisma.freelancerProfile.findMany({
      where: {
        ...this.publicVisibilityWhere(), id: { in: pageIds },
        ...(query.category ? { category: query.category } : {}),
      },
      select: PUBLIC_SELECT, orderBy: { id: 'asc' }, take: limit,
    });
    return {
      items: records.filter((profile) => providerProfileReadiness(profile).ready).map((profile) => this.serializePublic(profile)),
      nextCursor: matched.length > limit ? pageIds[pageIds.length - 1] : null,
    };
  }

  async getMyProfile(userId: string) {
    await this.assertEligible(this.prisma, userId);
    const profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId }, select: OWNER_SELECT,
    });
    // Visiting setup is not consent or an implicit profile creation.
    return profile ? { ...profile, statisticsProvenance: 'legacy_self_declared', readiness: providerProfileReadiness(profile) } : null;
  }

  async updateMyProfile(userId: string, dto: UpdateFreelancerProfileDto) {
    const unknown = Object.keys(dto).filter((key) => !WRITABLE_FIELDS.includes(key as (typeof WRITABLE_FIELDS)[number]));
    if (unknown.length) throw new BadRequestException('Only provider profile fields may be edited');
    const data = this.writableData(dto);
    return this.prisma.$transaction(async (tx) => {
      // Serialize setup/publication with other provider writes and user status
      // changes. A stale read cannot publish a concurrently incomplete profile.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
      await this.assertEligible(tx, userId);
      const existing = await tx.freelancerProfile.findUnique({ where: { userId }, select: OWNER_SELECT });
      const candidate = {
        providerEnabled: false, publicPreviewEnabled: false, category: null,
        headline: null, summary: null, skills: [], portfolioUrl: null, githubUrl: null,
        ...existing, ...data,
      };
      if (data.providerEnabled === false) {
        data.publicPreviewEnabled = false;
        candidate.publicPreviewEnabled = false;
      }
      if (candidate.publicPreviewEnabled) {
        if (!candidate.providerEnabled) throw new BadRequestException('Enable offering services before publishing your preview');
        const readiness = providerProfileReadiness(candidate);
        if (!readiness.ready) throw new BadRequestException(`Complete your provider profile before publishing: ${readiness.missingFields.join(', ')}`);
      }
      const profile = await tx.freelancerProfile.upsert({
        where: { userId },
        create: {
          userId, skills: [], expertise: [], country: 'Canada', currency: 'CAD',
          availableForRemote: true, ...data,
        },
        update: data,
        select: OWNER_SELECT,
      });
      return { ...profile, statisticsProvenance: 'legacy_self_declared', readiness: providerProfileReadiness(profile) };
    });
  }

  private publicVisibilityWhere(): Prisma.FreelancerProfileWhereInput {
    return {
      providerEnabled: true, publicPreviewEnabled: true,
      user: { is: { status: UserStatus.ACTIVE, role: { in: [UserRole.JOB_SEEKER, UserRole.FREELANCER] } } },
      category: { in: [...PROVIDER_CATEGORIES] },
      headline: { notIn: [''] }, summary: { notIn: [''] }, skills: { isEmpty: false },
      AND: [{ OR: [{ portfolioUrl: { notIn: [''] } }, { githubUrl: { notIn: [''] } }] }],
    };
  }

  private async assertEligible(database: Pick<PrismaService, 'user'> | Prisma.TransactionClient, userId: string) {
    const user = await database.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE || ![UserRole.JOB_SEEKER, UserRole.FREELANCER].includes(user.role as 'JOB_SEEKER' | 'FREELANCER')) {
      throw new ForbiddenException('An active personal account is required to offer services');
    }
  }

  private serializePublic(profile: PublicProfileRecord) {
    // Explicit serializer prevents future Prisma fields from becoming public.
    return {
      id: profile.id, userId: profile.userId, category: profile.category,
      headline: profile.headline, title: profile.title, summary: profile.summary,
      skills: profile.skills, expertise: profile.expertise,
      hourlyRate: profile.hourlyRate, currency: profile.currency,
      country: profile.country, city: profile.city, timezone: profile.timezone,
      availableForRemote: profile.availableForRemote,
      availability: PROVIDER_AVAILABILITY.includes(profile.availability as (typeof PROVIDER_AVAILABILITY)[number]) ? profile.availability : null,
      hoursPerWeek: profile.hoursPerWeek, portfolioUrl: safeProviderUrl(profile.portfolioUrl),
      githubUrl: safeProviderUrl(profile.githubUrl), linkedinUrl: safeProviderUrl(profile.linkedinUrl),
      workPreferences: profile.workPreferences.filter((value) => PROVIDER_WORK_PREFERENCES.includes(value as (typeof PROVIDER_WORK_PREFERENCES)[number])),
      createdAt: profile.createdAt, updatedAt: profile.updatedAt,
      user: {
        id: profile.user.id, displayName: profile.user.displayName,
        firstName: profile.user.firstName, lastName: profile.user.lastName, avatarUrl: profile.user.avatarUrl,
      },
    };
  }

  private writableData(dto: UpdateFreelancerProfileDto): WritableData {
    // Each field is allowlisted; no owner/role/trust value can cross this boundary.
    const data: Record<string, unknown> = {};
    for (const field of WRITABLE_FIELDS) {
      const value = dto[field];
      if (value === undefined) continue;
      data[field] = typeof value === 'string' ? value.trim() || null : value;
    }
    if (dto.skills) data.skills = normalizedLabels(dto.skills);
    if (dto.expertise) data.expertise = normalizedLabels(dto.expertise);
    return data as WritableData;
  }
}
