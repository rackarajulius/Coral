import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FreelancerProfile, Prisma, UserRole, UserStatus } from '@prisma/client';
import { publicFeaturedItems } from '../job-seekers/featured-items';
import { PROJECT_ORDER, PROJECT_SELECT, publicProjects } from '../job-seekers/profile-projects';
import { CitiesService } from '../locations/cities.service';
import { doneWorkFor } from '../marketplace/done-work';
import { PrismaService } from '../prisma/prisma.service';
import { readPlaceFilter, readProviderPlace } from './provider-place';
import { providerProfileReadiness, safeProviderUrl } from './provider-profile-policy';
import { UNCOUNTED_STATUSES, WINDOW_DAYS, measureResponsiveness } from './provider-responsiveness';
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

// Not completedProjects, rating or totalEarnings: those were typed in by the
// provider, Coral never measured them, and no screen shows them. What Coral
// does measure about a provider is how they reply (provider-responsiveness.ts).
const OWNER_SELECT = {
  ...PUBLIC_SELECT, providerEnabled: true, publicPreviewEnabled: true,
  placeCountryCode: true, placeRegion: true, placeCity: true,
} satisfies Prisma.FreelancerProfileSelect;

type OwnerProfileRecord = Prisma.FreelancerProfileGetPayload<{ select: typeof OWNER_SELECT }>;

/** A bare place name in a directory search is read as Canada's first: the pilot is there. */
const DIRECTORY_NEAR = 'CA';

/** As many Featured items, and projects, as the provider page shows. */
const MAX_FEATURED = 12;
const MAX_PROJECTS_SHOWN = 12;

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

/**
 * How deep the directory pages. Offset paging grows with depth, and twenty-four
 * pages of twelve is further than anyone browses; a search narrows past it.
 */
const MAX_DIRECTORY_PAGE = 24;

/** A page of saved professionals: the directory's twelve. */
const SAVED_PAGE_SIZE = 12;
/** Far more than anyone keeps track of, and it keeps the list of ids bounded. */
const MAX_SAVED = 500;

/** Treat search punctuation literally, including SQL LIKE's escape character. */
function literalSearchPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

@Injectable()
export class FreelancersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cities: CitiesService,
  ) {}

  async getPublicProfile(userId: string) {
    const profile = await this.prisma.freelancerProfile.findFirst({
      where: { ...this.publicVisibilityWhere(), userId }, select: PUBLIC_SELECT,
    });
    if (!profile || !providerProfileReadiness(profile).ready) {
      throw new NotFoundException('Provider profile not available');
    }
    return { ...this.serializePublic(profile), ...(await this.workFromProfile(userId)), doneWork: await doneWorkFor(this.prisma, userId) };
  }

  /**
   * The Featured items and projects from their profile, so their work sits
   * with their services; nothing when they've hidden their profile.
   * `fullProfile` says whether someone else can open that profile
   * (`/profile/:id` serves strangers only a discoverable one), so the page
   * only links to it then.
   */
  private async workFromProfile(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: {
        discoverable: true, privacySettings: true,
        portfolioItems: { orderBy: { createdAt: 'desc' }, take: MAX_FEATURED },
        projects: { select: PROJECT_SELECT, orderBy: PROJECT_ORDER, take: MAX_PROJECTS_SHOWN },
      },
    });
    const hidden = (profile?.privacySettings as { profileVisible?: boolean } | null)?.profileVisible === false;
    if (!profile || hidden) return { featured: [], projects: [], fullProfile: false };
    return {
      featured: publicFeaturedItems(profile.portfolioItems, userId),
      projects: await publicProjects(this.prisma, profile.projects, userId),
      fullProfile: profile.discoverable,
    };
  }

  async listPublicProfiles(query: ProviderDirectoryQueryDto) {
    const limit = query.limit ?? 12;
    const page = query.page ?? 1;
    const search = query.q?.trim();
    const location = query.location?.trim();
    if (!Number.isInteger(limit) || limit < 1 || limit > 24 || (search?.length ?? 0) > 100
      || (location?.length ?? 0) > 100
      || !Number.isInteger(page) || page < 1 || page > MAX_DIRECTORY_PAGE) {
      throw new BadRequestException('Provider search exceeds its allowed bounds');
    }
    // Where they're based, matched on the place read from their profile when
    // they saved it, never on the words. A place the list doesn't know finds
    // nobody, and says so, rather than being quietly ignored.
    const place = location ? readPlaceFilter(this.cities, location, DIRECTORY_NEAR) : undefined;
    const asked = location ? { place: place ? { kind: place.kind, label: place.label } : null } : {};
    if (location && !place) return { items: [], page, nextPage: null, ...asked };
    const placeClause = !place ? Prisma.empty
      : place.kind === 'country' ? Prisma.sql`AND profile.place_country_code = ${place.countryCode}`
      : place.kind === 'region' ? Prisma.sql`AND profile.place_country_code = ${place.countryCode} AND profile.place_region = ${place.region}`
      : Prisma.sql`AND profile.place_country_code = ${place.countryCode} AND profile.place_city = ${place.city}
          ${place.region ? Prisma.sql`AND profile.place_region = ${place.region}` : Prisma.empty}`;
    const pattern = search ? literalSearchPattern(search) : null;
    const escape = '\\';

    /**
     * The order, every part of it a reason that can be said out loud:
     *
     * 1. Searching, the best kind of match first — the name, the headline or
     *    a skill named exactly; then a partial skill or the job title; then
     *    words found only in the introduction.
     * 2. Who can take work now: available, limited, not said, unavailable.
     * 3. Who updated their profile most recently.
     *
     * No score and no hidden weighting. The id only breaks exact ties, so a
     * page is the same page each time it is asked for.
     */
    // Browsing leaves this out altogether: a bare `0` in ORDER BY is read by
    // PostgreSQL as "column number zero" and rejected.
    const relevanceOrder = pattern
      ? Prisma.sql`CASE
          WHEN account.display_name ILIKE ${pattern} ESCAPE ${escape}
            OR account.first_name ILIKE ${pattern} ESCAPE ${escape}
            OR account.last_name ILIKE ${pattern} ESCAPE ${escape}
            OR profile.headline ILIKE ${pattern} ESCAPE ${escape}
            OR EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE lower(btrim(label)) = lower(${search}))
            THEN 0
          WHEN profile.title ILIKE ${pattern} ESCAPE ${escape}
            OR EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE label ILIKE ${pattern} ESCAPE ${escape})
            THEN 1
          ELSE 2
        END ASC,`
      : Prisma.empty;
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
        ${placeClause}
        ${query.remote === 'true' ? Prisma.sql`AND profile.available_for_remote = true` : Prisma.empty}
        ${pattern ? Prisma.sql`AND (
          profile.headline ILIKE ${pattern} ESCAPE ${escape}
          OR profile.title ILIKE ${pattern} ESCAPE ${escape}
          OR profile.summary ILIKE ${pattern} ESCAPE ${escape}
          OR account.display_name ILIKE ${pattern} ESCAPE ${escape}
          OR account.first_name ILIKE ${pattern} ESCAPE ${escape}
          OR account.last_name ILIKE ${pattern} ESCAPE ${escape}
          OR EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE label ILIKE ${pattern} ESCAPE ${escape})
        )` : Prisma.empty}
      ORDER BY ${relevanceOrder}
        CASE profile.availability WHEN 'available' THEN 0 WHEN 'limited' THEN 1
          WHEN 'unavailable' THEN 3 WHEN 'not-available' THEN 3 ELSE 2 END ASC,
        profile.updated_at DESC, profile.id ASC
      LIMIT ${limit + 1} OFFSET ${(page - 1) * limit}
    `);
    const pageIds = matched.slice(0, limit).map((record) => record.id);
    if (!pageIds.length) return { items: [], page, nextPage: null, ...asked };
    // Recheck consent/status on the projection, including withdrawal between
    // the ID lookup and read.
    const records = await this.prisma.freelancerProfile.findMany({
      where: {
        ...this.publicVisibilityWhere(), id: { in: pageIds },
        ...(query.category ? { category: query.category } : {}),
      },
      select: PUBLIC_SELECT, take: limit,
    });
    // The read comes back in no particular order; put it back in the
    // directory's.
    const byId = new Map(records.map((profile) => [profile.id, profile]));
    const ordered = pageIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return {
      items: ordered.filter((profile) => providerProfileReadiness(profile).ready).map((profile) => this.serializePublic(profile)),
      page,
      // The last allowed page offers no next one, rather than a link that fails.
      nextPage: matched.length > limit && page < MAX_DIRECTORY_PAGE ? page + 1 : null,
      ...asked,
    };
  }

  /**
   * The professionals someone saved, newest first, shaped as the directory's
   * cards are. Only those who are public now: someone who goes private drops
   * off the list without the row being lost, so they return if they come back.
   */
  async listSaved(userId: string, page = 1) {
    if (!Number.isInteger(page) || page < 1) throw new BadRequestException('That page does not exist');
    const rows = await this.prisma.savedProfessional.findMany({
      where: { userId, professional: { is: { freelancerProfile: { is: this.publicVisibilityWhere() } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * SAVED_PAGE_SIZE,
      take: SAVED_PAGE_SIZE + 1,
      select: { professional: { select: { freelancerProfile: { select: PUBLIC_SELECT } } } },
    });
    const profiles = rows.slice(0, SAVED_PAGE_SIZE).flatMap((row) => row.professional.freelancerProfile ?? []);
    return {
      items: profiles.filter((profile) => providerProfileReadiness(profile).ready).map((profile) => this.serializePublic(profile)),
      page,
      nextPage: rows.length > SAVED_PAGE_SIZE ? page + 1 : null,
    };
  }

  /** Who someone has saved, so every Save button on a page can say so from one request. */
  async savedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.savedProfessional.findMany({
      where: { userId }, select: { professionalId: true }, take: MAX_SAVED,
    });
    return rows.map((row) => row.professionalId);
  }

  /**
   * Saves a professional. Doing it twice changes nothing. They aren't told,
   * and nothing about it is shown to anyone else: a follow is public, this is
   * a private list. The same 404 as their profile for anyone not public, so
   * this can't be used to ask whether a private account exists.
   */
  async save(userId: string, professionalId: string): Promise<void> {
    if (userId === professionalId) throw new BadRequestException('You cannot save your own profile');
    const profile = await this.prisma.freelancerProfile.findFirst({
      where: { ...this.publicVisibilityWhere(), userId: professionalId }, select: PUBLIC_SELECT,
    });
    if (!profile || !providerProfileReadiness(profile).ready) {
      throw new NotFoundException('Provider profile not available');
    }
    if (await this.prisma.savedProfessional.count({ where: { userId } }) >= MAX_SAVED) {
      throw new BadRequestException(`You can save up to ${MAX_SAVED} professionals. Remove some to save more.`);
    }
    await this.prisma.savedProfessional.upsert({
      where: { userId_professionalId: { userId, professionalId } },
      create: { userId, professionalId },
      update: {},
    });
  }

  /** Works for someone who has since gone private too; removing what isn't saved is no error. */
  async unsave(userId: string, professionalId: string): Promise<void> {
    await this.prisma.savedProfessional.deleteMany({ where: { userId, professionalId } });
  }

  /**
   * How a public provider replies to requests, once there is enough to say;
   * null until then. The same visibility as their profile: a private or
   * paused provider has nothing public, and gets the same 404.
   */
  async getPublicResponsiveness(userId: string) {
    const profile = await this.prisma.freelancerProfile.findFirst({
      where: { ...this.publicVisibilityWhere(), userId }, select: PUBLIC_SELECT,
    });
    if (!profile || !providerProfileReadiness(profile).ready) {
      throw new NotFoundException('Provider profile not available');
    }
    const measured = await this.measureReplies(userId);
    return measured.available ? measured : null;
  }

  /** The provider's own figures, including how far they are from being shown. */
  async getMyResponsiveness(userId: string) {
    await this.assertEligible(this.prisma, userId);
    return this.measureReplies(userId);
  }

  /** Requests for their own services, not a company's, from the counted window. */
  private async measureReplies(userId: string) {
    const requests = await this.prisma.marketplaceRequest.findMany({
      where: {
        recipientId: userId, recipientCompanyId: null, kind: 'service',
        createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        status: { notIn: UNCOUNTED_STATUSES },
      },
      select: { status: true, createdAt: true, recipientRespondedAt: true },
    });
    return measureResponsiveness(requests);
  }

  async getMyProfile(userId: string) {
    await this.assertEligible(this.prisma, userId);
    const profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId }, select: OWNER_SELECT,
    });
    // Visiting setup is not consent or an implicit profile creation.
    // The preview shows the same work a visitor would see.
    return profile ? { ...this.ownerView(profile), ...(await this.workFromProfile(userId)), doneWork: await doneWorkFor(this.prisma, userId) } : null;
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
      // Where they're based, read again from what this save leaves in place;
      // every save also mends a row saved before places were read.
      const place = readProviderPlace(
        this.cities,
        'city' in data ? data.city : existing?.city,
        'country' in data ? data.country : existing ? existing.country : 'Canada',
      );
      const profile = await tx.freelancerProfile.upsert({
        where: { userId },
        create: {
          userId, skills: [], expertise: [], country: 'Canada', currency: 'CAD',
          availableForRemote: true, ...data, ...place,
        },
        update: { ...data, ...place },
        select: OWNER_SELECT,
      });
      return this.ownerView(profile);
    });
  }

  /** The owner's own view, with where the directory places them, in words. */
  private ownerView(profile: OwnerProfileRecord) {
    const { placeCountryCode, placeRegion, placeCity, ...rest } = profile;
    return {
      ...rest, readiness: providerProfileReadiness(profile),
      // A location search finds them under each of these.
      place: placeCountryCode
        ? { city: placeCity, region: placeRegion, country: this.cities.countryName(placeCountryCode) ?? placeCountryCode }
        : null,
    };
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
