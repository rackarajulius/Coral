import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnMedia } from '../community/own-media';
import { normalizedLabels } from '../marketplace/marketplace-policy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { featuredLink } from './featured-items';
import { monthOf, monthToDate, ownerProject, PROJECT_ORDER, PROJECT_SELECT } from './profile-projects';

/** As many projects as one profile keeps. */
export const MAX_PROJECTS = 20;
/** Pictures per project; it can also have one video. */
export const PROJECT_MAX_PICTURES = 8;

/** A project's fields as they stand, before or after an edit. */
interface Draft {
  title: string;
  description: string;
  startMonth: string | null;
  endMonth: string | null;
  current: boolean;
  skills: string[];
  projectUrl: string | null;
  mediaUrls: string[];
  experienceId: string | null;
  serviceListingId: string | null;
}

/**
 * The projects on a job seeker's own profile.
 *
 * Self-described, like the rest of the profile. What is checked: the dates
 * make sense, the link is a web address, the pictures and video are their own
 * uploads, and a linked job or service is theirs.
 */
@Injectable()
export class ProfileProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return [];
    const projects = await this.prisma.profileProject.findMany({
      where: { profileId: profile.id }, select: PROJECT_SELECT, orderBy: PROJECT_ORDER,
    });
    return projects.map((project) => ownerProject(project, userId));
  }

  async create(userId: string, dto: CreateProjectDto) {
    const profile = await this.profileOf(userId);
    if (await this.prisma.profileProject.count({ where: { profileId: profile.id } }) >= MAX_PROJECTS) {
      throw new BadRequestException(`A profile can show up to ${MAX_PROJECTS} projects`);
    }
    const draft = await this.checked(userId, profile.id, {
      title: '', description: '', startMonth: null, endMonth: null, current: false, skills: [],
      projectUrl: null, mediaUrls: [], experienceId: null, serviceListingId: null, ...this.given(dto),
    });
    const project = await this.prisma.profileProject.create({
      data: { profileId: profile.id, ...this.columns(draft) }, select: PROJECT_SELECT,
    });
    return ownerProject(project, userId);
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const profile = await this.profileOf(userId);
    const existing = await this.prisma.profileProject.findFirst({
      where: { id: projectId, profileId: profile.id }, select: PROJECT_SELECT,
    });
    // Someone else's project is "not found", the same as one that never was.
    if (!existing) throw new NotFoundException('Project not found');
    const draft = await this.checked(userId, profile.id, {
      title: existing.title, description: existing.description,
      startMonth: monthOf(existing.startDate), endMonth: monthOf(existing.endDate), current: existing.current,
      skills: existing.skills, projectUrl: existing.projectUrl, mediaUrls: existing.mediaUrls,
      experienceId: existing.experienceId, serviceListingId: existing.serviceListingId,
      ...this.given(dto),
    });
    const project = await this.prisma.profileProject.update({
      where: { id: existing.id }, data: this.columns(draft), select: PROJECT_SELECT,
    });
    return ownerProject(project, userId);
  }

  async remove(userId: string, projectId: string) {
    const profile = await this.profileOf(userId);
    const { count } = await this.prisma.profileProject.deleteMany({ where: { id: projectId, profileId: profile.id } });
    if (!count) throw new NotFoundException('Project not found');
    // Its pictures and video go with the hourly clean-up once nothing uses them.
  }

  private async profileOf(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException('Set up your profile first');
    return profile;
  }

  /** Only the fields the request sent; null clears a field. */
  private given(dto: CreateProjectDto | UpdateProjectDto): Partial<Draft> {
    const out: Partial<Draft> = {};
    if (dto.title !== undefined) out.title = dto.title;
    if (dto.description !== undefined) out.description = dto.description ?? '';
    if (dto.startMonth !== undefined) out.startMonth = dto.startMonth;
    if (dto.endMonth !== undefined) out.endMonth = dto.endMonth;
    if (dto.current !== undefined) out.current = dto.current;
    if (dto.skills !== undefined) out.skills = dto.skills;
    if (dto.projectUrl !== undefined) out.projectUrl = dto.projectUrl;
    if (dto.mediaUrls !== undefined) out.mediaUrls = dto.mediaUrls;
    if (dto.experienceId !== undefined) out.experienceId = dto.experienceId;
    if (dto.serviceListingId !== undefined) out.serviceListingId = dto.serviceListingId;
    return out;
  }

  /** The project as it will be saved, or why it can't be. */
  private async checked(userId: string, profileId: string, draft: Draft): Promise<Draft> {
    const title = draft.title.trim().replace(/\s+/g, ' ');
    if (!title) throw new BadRequestException('Give the project a name');

    // Ongoing has no end; an end can't come before the start.
    const endMonth = draft.current ? null : draft.endMonth;
    if (draft.startMonth && endMonth && endMonth < draft.startMonth) {
      throw new BadRequestException('A project can’t end before it starts');
    }

    const link = draft.projectUrl?.trim() ? featuredLink(draft.projectUrl) : null;
    if (draft.projectUrl?.trim() && !link) throw new BadRequestException('The link has to be a web address');

    assertOwnMedia(draft.mediaUrls, userId, { maxPictures: PROJECT_MAX_PICTURES, subject: 'A project', owner: 'you' });

    if (draft.experienceId && draft.serviceListingId) {
      throw new BadRequestException('Link a project to a job or a service, not both');
    }
    if (draft.experienceId) {
      const job = await this.prisma.experience.findFirst({ where: { id: draft.experienceId, profileId }, select: { id: true } });
      if (!job) throw new BadRequestException('That job isn’t on your profile');
    }
    if (draft.serviceListingId) {
      // Their own, offered as themselves: a company's service isn't theirs to claim work under.
      const service = await this.prisma.serviceListing.findFirst({
        where: { id: draft.serviceListingId, ownerUserId: userId, companyId: null }, select: { id: true },
      });
      if (!service) throw new BadRequestException('That service isn’t one of yours');
    }

    return {
      ...draft, title, endMonth, projectUrl: link,
      description: draft.description.trim(),
      skills: normalizedLabels(draft.skills).slice(0, 10),
    };
  }

  private columns(draft: Draft) {
    return {
      title: draft.title, description: draft.description,
      startDate: monthToDate(draft.startMonth), endDate: monthToDate(draft.endMonth), current: draft.current,
      skills: draft.skills, projectUrl: draft.projectUrl, mediaUrls: draft.mediaUrls,
      experienceId: draft.experienceId, serviceListingId: draft.serviceListingId,
    };
  }
}
