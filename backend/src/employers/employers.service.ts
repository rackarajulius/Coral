import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, PROFILE_BUCKET, COMPANY_BUCKET } from '../storage/storage.service';
import {
  CreateEmployerCompanyDto,
  EmployerCompaniesQueryDto,
  UpdateEmployerCompanyDto,
} from './dto/employer-company.dto';
import { computeVerificationStatus, raiseVerificationLevel } from './utils/email-domain.util';
import { CompanyAuditService } from '../company/company-audit.service';

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

  async getMyCompany(userId: string) {
    return this.getOrCreateProfile(userId);
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
    const profile = await this.getOrCreateProfile(userId);
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

    return this.prisma.employerProfile.create({
      data: {
        userId,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        companyLogo: dto.companyLogo,
        companyWebsite: dto.companyWebsite,
        companySize: dto.companySize,
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
    await this.getOrCreateProfile(userId);
    const isVideo = file.mimetype.startsWith('video/');
    const bucket = isVideo ? PROFILE_BUCKET : COMPANY_BUCKET;
    const ext = file.mimetype.split('/')[1] || (isVideo ? 'mp4' : 'png');
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `media/${userId}-${Date.now()}-${rand}.${ext}`;
    const url = await this.storageService.uploadPublicFile(path, file.buffer, file.mimetype, bucket);
    return { url };
  }

  async updateMyCompany(userId: string, dto: UpdateEmployerCompanyDto) {
    // Which fields moved, not their values: a company profile can hold long
    // free text, and an audit row is a record of the change, not a copy of it.
    const changed = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    const profile = await this.getOrCreateProfile(userId);
    const { socialLinks, locations, coreValues, galleryPhotos, whyWorkHere, awards, deiStats, ...rest } = dto;

    const updated = await this.prisma.employerProfile.update({
      where: { id: profile.id },
      data: {
        ...rest,
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
            computeVerificationStatus(profile.user.email, dto.companyWebsite),
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

  async getCompanyById(companyId: string) {
    const company = await this.prisma.employerProfile.findUnique({
      where: { id: companyId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            emailVerified: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!company || company.visibility === 'private') {
      throw new NotFoundException('Company profile not found');
    }

    const [openJobsByUser, followerCount] = await Promise.all([
      this.getOpenJobCounts([company.userId]),
      this.prisma.companyFollow.count({ where: { companyId: company.id } }),
    ]);

    return {
      ...company,
      openJobs: openJobsByUser.get(company.userId) ?? 0,
      followerCount,
    };
  }

  /** Follows a company on behalf of the given user. Idempotent. */
  async followCompany(userId: string, companyId: string) {
    const company = await this.prisma.employerProfile.findUnique({
      where: { id: companyId },
      select: { id: true, userId: true, allowFollow: true, visibility: true },
    });

    if (!company || company.visibility === 'private') {
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
  async unfollowCompany(userId: string, companyId: string) {
    await this.prisma.companyFollow.deleteMany({ where: { userId, companyId } });
    return this.getFollowStatus(userId, companyId);
  }

  /** Whether the user follows the company, plus the company's total follower count. */
  async getFollowStatus(userId: string | null, companyId: string) {
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
  async getSimilarCompanies(companyId: string, limit = 8) {
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
        ...(or.length ? { OR: or } : {}),
      },
      select: {
        id: true,
        userId: true,
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

    const openJobsByUser = await this.getOpenJobCounts(companies.map((c) => c.userId));

    return companies.map((c) => ({
      id: c.id,
      name: c.companyName,
      // "Primary · Secondary" (e.g. "Fintech · Commerce") from the industry + first distinct sub-industry.
      industry: this.buildIndustryLabel(c.industry, c.industries),
      // Two-line "about" blurb for the card.
      description: c.companyDescription ?? c.overview ?? c.tagline ?? c.mission ?? '',
      cover: c.companyBanner ?? c.companyLogo ?? null,
      logo: c.companyLogo ?? null,
      openJobs: openJobsByUser.get(c.userId) ?? 0,
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
          userId: true,
          companyName: true,
          companyLogo: true,
          companyDescription: true,
          companyBenefits: true,
          tagline: true,
          headquarters: true,
          companySize: true,
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

    const openJobsByUser = await this.getOpenJobCounts(data.map((company) => company.userId));

    return {
      data: data.map((company) => ({
        ...company,
        openJobs: openJobsByUser.get(company.userId) ?? 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  private async getOpenJobCounts(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, number>();
    }

    const counts = await this.prisma.job.groupBy({
      by: ['postedById'],
      // Open jobs are stored as 'published' (the admin UI just labels it "Active").
      where: { postedById: { in: userIds }, status: 'published' },
      _count: { _all: true },
    });

    return new Map(counts.map((count) => [count.postedById, count._count._all]));
  }

  private async getOrCreateProfile(userId: string) {
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

