import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyMemberStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, PROFILE_BUCKET, COMPANY_BUCKET } from '../storage/storage.service';
import {
  CreateEmployerCompanyDto,
  EmployerCompaniesQueryDto,
  UpdateEmployerCompanyDto,
} from './dto/employer-company.dto';
import { computeVerificationStatus, raiseVerificationLevel } from './utils/email-domain.util';
import { CompanyAuditService } from '../company/company-audit.service';
import {
  IS_LIVE_PAGE,
  resolvePageRef,
  companyPageId,
  postersByPage,
} from '../company/company-page';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';

const PROFILE_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      emailVerified: true,
    },
  },
} as const;

@Injectable()
export class EmployersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly audit: CompanyAuditService,
  ) {}

  /**
   * The company page this person edits and is shown under: their company's
   * page, whoever on the team created it, or their own profile when they
   * belong to no company.
   */
  async getMyCompany(userId: string) {
    return this.getOrCreatePage(userId);
  }

  async uploadCompanyLogo(userId: string, file: Express.Multer.File) {
    return this.uploadCompanyImage(userId, file, 'logos', 'companyLogo');
  }

  async uploadCompanyBanner(userId: string, file: Express.Multer.File) {
    return this.uploadCompanyImage(userId, file, 'banners', 'companyBanner');
  }

  private async uploadCompanyImage(
    userId: string,
    file: Express.Multer.File,
    folder: 'logos' | 'banners',
    field: 'companyLogo' | 'companyBanner',
  ) {
    const profile = await this.getOrCreatePage(userId);
    const ext = file.mimetype.split('/')[1] || 'png';
    const path = `${folder}/${userId}-${Date.now()}.${ext}`;

    const publicUrl = await this.storageService.uploadPublicFile(path, file.buffer, file.mimetype);
    const oldPath = this.storageService.pathFromPublicUrl(profile[field]);

    const updated = await this.prisma.employerProfile.update({
      where: { id: profile.id },
      data: field === 'companyLogo' ? { companyLogo: publicUrl } : { companyBanner: publicUrl },
      include: PROFILE_INCLUDE,
    });

    if (oldPath) {
      await this.storageService.deletePublicFile(oldPath);
    }

    return updated;
  }

  async createCompany(userId: string, dto: CreateEmployerCompanyDto, email: string) {
    const existingProfile = await this.prisma.employerProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new BadRequestException('Employer company profile already exists');
    }
    // A member's company already has its page. A profile made here would be
    // a copy of it, listed as a second company.
    const seat = await this.prisma.companyMember.findFirst({
      where: { userId, status: { not: CompanyMemberStatus.PENDING } },
      select: { id: true },
    });
    if (seat) {
      throw new BadRequestException('Your company already has a page. Edit it instead.');
    }

    return this.prisma.employerProfile.create({
      data: {
        userId,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        companyLogo: dto.companyLogo,
        companyWebsite: dto.companyWebsite,
        companySize: dto.companySize,
        companyType: dto.companyType,
        industry: dto.industry,
        department: dto.department,
        isHiringManager: dto.isHiringManager ?? false,
        isRecruiter: dto.isRecruiter ?? false,
        isAdmin: dto.isAdmin ?? false,
        companyDescription: dto.companyDescription,
        companyBenefits: dto.companyBenefits ?? [],
        companyCulture: dto.companyCulture,
        culturePhilosophy: dto.culturePhilosophy,
        cultureCollaboration: dto.cultureCollaboration,
        cultureImageUrl: dto.cultureImageUrl,
        headquarters: dto.headquarters,
        companyLocations: dto.companyLocations ?? [],
        socialLinks: (dto.socialLinks ?? []) as unknown as Prisma.InputJsonValue,
        tagline: dto.tagline,
        companyBanner: dto.companyBanner,
        foundedYear: dto.foundedYear,
        industries: dto.industries ?? [],
        locations: (dto.locations ?? []) as unknown as Prisma.InputJsonValue,
        coreValues: (dto.coreValues ?? []) as unknown as Prisma.InputJsonValue,
        galleryPhotos: (dto.galleryPhotos ?? []) as unknown as Prisma.InputJsonValue,
        whyWorkHere: (dto.whyWorkHere ?? []) as unknown as Prisma.InputJsonValue,
        awards: (dto.awards ?? []) as unknown as Prisma.InputJsonValue,
        diversityStatement: dto.diversityStatement,
        deiStats: (dto.deiStats ?? []) as unknown as Prisma.InputJsonValue,
        cultureVideoUrl: dto.cultureVideoUrl,
        overview: dto.overview,
        mission: dto.mission,
        vision: dto.vision,
        visibility: dto.visibility ?? 'public',
        showJobs: dto.showJobs ?? true,
        allowFollow: dto.allowFollow ?? true,
        // A matching domain is worth `domain_verified` at most; the badge
        // candidates see still requires a document reviewed by a person.
        verificationStatus: raiseVerificationLevel(
          'unverified',
          computeVerificationStatus(email, dto.companyWebsite),
        ),
      },
    });
  }

  /**
   * Uploads a gallery image or culture video and returns its public URL.
   * Images go to the company bucket; videos to the larger profile-media bucket
   * (the company bucket caps at 5MB / images only). The caller stores the
   * returned URL on the company record via {@link updateMyCompany}.
   */
  async uploadCompanyMedia(userId: string, file: Express.Multer.File): Promise<{ url: string }> {
    await this.getOrCreatePage(userId);
    const isVideo = file.mimetype.startsWith('video/');
    const bucket = isVideo ? PROFILE_BUCKET : COMPANY_BUCKET;
    const ext = file.mimetype.split('/')[1] || (isVideo ? 'mp4' : 'png');
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `media/${userId}-${Date.now()}-${rand}.${ext}`;
    const url = await this.storageService.uploadPublicFile(path, file.buffer, file.mimetype, bucket);
    return { url };
  }

  /**
   * Edits the company's page — the one everyone sees — whichever owner or
   * admin is doing it. The website check reads the editor's own address: it
   * is their email that either matches the domain or doesn't.
   */
  async updateMyCompany(actor: { id: string; email: string }, dto: UpdateEmployerCompanyDto) {
    const userId = actor.id;
    // Which fields moved, not their values: a company profile can hold long
    // free text, and an audit row is a record of the change, not a copy of it.
    const changed = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    const profile = await this.getOrCreatePage(userId);
    const {
      socialLinks, locations, coreValues, galleryPhotos, whyWorkHere, awards, deiStats,
      jobTitle, department, isHiringManager, isRecruiter, isAdmin,
      ...rest
    } = dto;

    // Job title and the like describe the editor, not the company. On their
    // own page they land on it as before; on a teammate's page they go to the
    // editor's own row, never onto the person whose page it is.
    const personal = Object.fromEntries(
      Object.entries({ jobTitle, department, isHiringManager, isRecruiter, isAdmin })
        .filter(([, v]) => v !== undefined),
    );
    const ownPage = profile.userId === userId;
    if (!ownPage && Object.keys(personal).length > 0) {
      await this.prisma.employerProfile.updateMany({ where: { userId }, data: personal });
    }

    const updated = await this.prisma.employerProfile.update({
      where: { id: profile.id },
      data: {
        ...rest,
        ...(ownPage ? personal : {}),
        ...(socialLinks !== undefined && {
          socialLinks: socialLinks as unknown as Prisma.InputJsonValue,
        }),
        ...(locations !== undefined && {
          locations: locations as unknown as Prisma.InputJsonValue,
        }),
        ...(coreValues !== undefined && {
          coreValues: coreValues as unknown as Prisma.InputJsonValue,
        }),
        ...(galleryPhotos !== undefined && {
          galleryPhotos: galleryPhotos as unknown as Prisma.InputJsonValue,
        }),
        ...(whyWorkHere !== undefined && {
          whyWorkHere: whyWorkHere as unknown as Prisma.InputJsonValue,
        }),
        ...(awards !== undefined && {
          awards: awards as unknown as Prisma.InputJsonValue,
        }),
        ...(deiStats !== undefined && {
          deiStats: deiStats as unknown as Prisma.InputJsonValue,
        }),
        // Only ever raises the level — see raiseVerificationLevel. Editing a
        // website must not cost an employer a verification a person granted.
        ...(dto.companyWebsite !== undefined && {
          verificationStatus: raiseVerificationLevel(
            profile.verificationStatus,
            computeVerificationStatus(actor.email, dto.companyWebsite),
          ),
        }),
      },
    });

    if (changed.length > 0) {
      void this.audit.recordForUserId(userId, {
        category: 'COMPANY',
        action: 'Updated the company profile',
        entityType: 'Company',
        summary: `Updated the company profile (${changed.slice(0, 6).join(', ')}${changed.length > 6 ? `, +${changed.length - 6} more` : ''})`,
      });
    }

    return updated;
  }

  /**
   * A company's public page.
   *
   * Any profile id resolves to the page it stands for: a teammate's own row —
   * where their jobs used to link — answers with their company's page, whose
   * id the client then shows in the address bar.
   */
  async getCompanyById(companyId: string) {
    const pageId = (await resolvePageRef(this.prisma, companyId)) ?? companyId;
    const record = await this.prisma.employerProfile.findUnique({
      where: { id: pageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            emailVerified: true,
            avatarUrl: true,
          },
        },
        // Only the domain: it is the company's only once proven.
        company: { select: { domain: true } },
        // Whether its company has taken the page down.
        pageOf: { select: { deactivatedAt: true } },
      },
    });
    // A deactivated page is gone to visitors, as on LinkedIn, until an owner
    // brings it back (company-status.service.ts).
    if (!record || record.visibility === 'private' || record.pageOf?.deactivatedAt) {
      throw new NotFoundException('Company profile not found');
    }
    const { company: organisation, pageOf: _pageOf, ...company } = record;

    const [openJobsByPage, followerCount] = await Promise.all([
      this.openJobsByPage([company]),
      this.prisma.companyFollow.count({ where: { companyId: company.id } }),
    ]);

    return {
      ...company,
      openJobs: openJobsByPage.get(company.id) ?? 0,
      followerCount,
      /** The domain the company has proven it owns, shown as such; null when unclaimed. */
      verifiedDomain: organisation?.domain ?? null,
    };
  }

  /**
   * Follows a company on behalf of the given user. Idempotent.
   *
   * Always the company's page, whichever of its members' profiles the button
   * was pressed on, so a company has one set of followers.
   */
  async followCompany(userId: string, profileId: string) {
    const companyId = (await resolvePageRef(this.prisma, profileId)) ?? profileId;
    const company = await this.prisma.employerProfile.findUnique({
      where: { id: companyId },
      select: { id: true, userId: true, allowFollow: true, visibility: true, pageOf: { select: { deactivatedAt: true } } },
    });

    if (!company || company.visibility === 'private' || company.pageOf?.deactivatedAt) {
      throw new NotFoundException('Company profile not found');
    }
    if (!company.allowFollow) {
      throw new BadRequestException('This company is not accepting followers');
    }
    if (company.userId === userId) {
      throw new BadRequestException('You cannot follow your own company');
    }

    await this.prisma.companyFollow.upsert({
      where: { userId_companyId: { userId, companyId } },
      create: { userId, companyId },
      update: {},
    });

    return this.getFollowStatus(userId, companyId);
  }

  /** Unfollows a company. Idempotent — unfollowing when not following is a no-op. */
  async unfollowCompany(userId: string, profileId: string) {
    const companyId = (await resolvePageRef(this.prisma, profileId)) ?? profileId;
    await this.prisma.companyFollow.deleteMany({ where: { userId, companyId } });
    return this.getFollowStatus(userId, companyId);
  }

  /** Whether the user follows the company, plus the company's total follower count. */
  async getFollowStatus(userId: string | null, profileId: string) {
    const companyId = (await resolvePageRef(this.prisma, profileId)) ?? profileId;
    const [following, followerCount] = await Promise.all([
      userId
        ? this.prisma.companyFollow.findUnique({
            where: { userId_companyId: { userId, companyId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.companyFollow.count({ where: { companyId } }),
    ]);

    return { isFollowing: !!following, followerCount };
  }

  /** Public companies in the same industry as the given one (for the "Companies you might love" rail). */
  async getSimilarCompanies(profileId: string, limit = 8) {
    const companyId = (await resolvePageRef(this.prisma, profileId)) ?? profileId;
    const target = await this.prisma.employerProfile.findUnique({
      where: { id: companyId },
      select: { id: true, industry: true, industries: true },
    });
    if (!target) return [];

    const or: Prisma.EmployerProfileWhereInput[] = [];
    if (target.industry) or.push({ industry: target.industry });
    if (target.industries?.length) or.push({ industries: { hasSome: target.industries } });

    const companies = await this.prisma.employerProfile.findMany({
      where: {
        visibility: 'public',
        id: { not: companyId },
        // Pages only: a member's copy of another company is not a company.
        AND: [IS_LIVE_PAGE, ...(or.length ? [{ OR: or }] : [])],
      },
      select: {
        id: true,
        slug: true,
        userId: true,
        companyId: true,
        companyName: true,
        companyLogo: true,
        companyBanner: true,
        companyDescription: true,
        tagline: true,
        overview: true,
        mission: true,
        industry: true,
        industries: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 20),
    });

    const openJobsByPage = await this.openJobsByPage(companies);

    return companies.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.companyName,
      // "Primary · Secondary" (e.g. "Fintech · Commerce") from the industry + first distinct sub-industry.
      industry: this.buildIndustryLabel(c.industry, c.industries),
      // Two-line "about" blurb for the card.
      description: c.companyDescription ?? c.overview ?? c.tagline ?? c.mission ?? '',
      cover: c.companyBanner ?? c.companyLogo ?? null,
      logo: c.companyLogo ?? null,
      openJobs: openJobsByPage.get(c.id) ?? 0,
    }));
  }

  /** Builds a "Primary · Secondary" industry label from the industry + industries[] fields. */
  private buildIndustryLabel(primary: string | null, list: string[] | null): string {
    const parts: string[] = [];
    if (primary) parts.push(primary);
    for (const i of list ?? []) {
      if (i && !parts.includes(i)) parts.push(i);
      if (parts.length >= 2) break;
    }
    return parts.join(' · ') || 'Company';
  }

  async listCompanies(query: EmployerCompaniesQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.EmployerProfileWhereInput = {
      visibility: 'public',
      // Pages only: a member's copy of their company is not another company.
      AND: [IS_LIVE_PAGE],
      ...(query.query
        ? {
            OR: [
              { companyName: { contains: query.query, mode: 'insensitive' as const } },
              { industry: { contains: query.query, mode: 'insensitive' as const } },
              { headquarters: { contains: query.query, mode: 'insensitive' as const } },
              { tagline: { contains: query.query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.employerProfile.findMany({
        where,
        select: {
          id: true,
          slug: true,
          userId: true,
          companyId: true,
          companyName: true,
          companyLogo: true,
          companyDescription: true,
          companyBenefits: true,
          tagline: true,
          headquarters: true,
          companySize: true,
          companyType: true,
          industry: true,
          industries: true,
          locations: true,
          verificationStatus: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.employerProfile.count({ where }),
    ]);

    const openJobsByPage = await this.openJobsByPage(data);

    return {
      data: data.map(({ companyId: _companyId, ...company }) => ({
        ...company,
        openJobs: openJobsByPage.get(company.id) ?? 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * Open jobs per page, counting every member's postings — a company's jobs
   * are its people's, not only the jobs of whoever created its page.
   */
  private async openJobsByPage(pages: Array<{ id: string; userId: string; companyId: string | null }>) {
    const posters = await postersByPage(this.prisma, pages);
    const counts = await this.getOpenJobCounts([...new Set([...posters.values()].flat())]);
    return new Map(
      [...posters].map(([pageId, ids]) => [pageId, ids.reduce((n, id) => n + (counts.get(id) ?? 0), 0)]),
    );
  }

  private async getOpenJobCounts(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, number>();
    }

    const counts = await this.prisma.job.groupBy({
      by: ['postedById'],
      // Live jobs are 'active'. This used to count 'published', which no job
      // has ever had, so every company showed 0 open jobs.
      where: { postedById: { in: userIds }, status: { in: LIVE_JOB_STATUSES } },
      _count: { _all: true },
    });

    return new Map(counts.map((count) => [count.postedById, count._count._all]));
  }

  /**
   * The page this person edits and is shown under.
   *
   * A member of a company gets the company's page, whoever created it. A
   * company with no page yet (its page was deleted) adopts one; with nothing
   * to adopt, this person's own profile becomes it. Only someone with no
   * company falls back to a profile of their own, the sole-operator case —
   * a member is never given a stray copy of their company.
   */
  private async getOrCreatePage(userId: string) {
    // CompanyContextService's rule: the oldest membership that isn't a
    // request, and only while it is active.
    const seat = await this.prisma.companyMember.findFirst({
      where: { userId, status: { not: CompanyMemberStatus.PENDING } },
      orderBy: { createdAt: 'asc' },
      select: { companyId: true, status: true, company: { select: { name: true } } },
    });

    if (seat?.status === CompanyMemberStatus.ACTIVE) {
      let pageId = await companyPageId(this.prisma, seat.companyId);
      if (!pageId) {
        const own = await this.prisma.employerProfile.upsert({
          where: { userId },
          create: {
            userId,
            companyId: seat.companyId,
            companyName: seat.company.name,
            jobTitle: '',
            companyBenefits: [],
            companyLocations: [],
          },
          update: { companyId: seat.companyId },
          select: { id: true },
        });
        await this.prisma.company.updateMany({
          where: { id: seat.companyId, pageId: null },
          data: { pageId: own.id },
        });
        pageId = (await companyPageId(this.prisma, seat.companyId)) ?? own.id;
      }
      const page = await this.prisma.employerProfile.findUnique({
        where: { id: pageId },
        include: PROFILE_INCLUDE,
      });
      if (page) return page;
    }

    let profile = await this.prisma.employerProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });

    if (!profile) {
      profile = await this.prisma.employerProfile.create({
        data: {
          userId,
          companyName: 'New Company',
          jobTitle: 'Hiring Manager',
          companyBenefits: [],
          companyLocations: [],
        },
        include: PROFILE_INCLUDE,
      });
    }

    return profile;
  }
}

