import { Prisma } from '@prisma/client';
import { ownUploadedMedia } from '../community/own-media';
import { publicServiceWhere } from '../marketplace/marketplace-policy';
import { featuredLink } from './featured-items';

/**
 * Projects on a profile, as visitors see them: on the profile, on the
 * person's provider page, and on the service a project was done as.
 */

export const PROJECT_SELECT = {
  id: true, title: true, description: true, startDate: true, endDate: true, current: true,
  skills: true, projectUrl: true, mediaUrls: true, experienceId: true, serviceListingId: true,
  experience: { select: { title: true, company: true } },
  serviceListing: { select: { id: true, title: true } },
} satisfies Prisma.ProfileProjectSelect;

export type ProjectRecord = Prisma.ProfileProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

/** Ongoing first, then the most recently finished; undated ones last. */
export const PROJECT_ORDER: Prisma.ProfileProjectOrderByWithRelationInput[] = [
  { current: 'desc' },
  { endDate: { sort: 'desc', nulls: 'last' } },
  { startDate: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
];

/** The job or service a project was done in, as a visitor may follow it. */
export type ProjectAssociation =
  | { kind: 'job'; title: string; company: string }
  | { kind: 'service'; id: string; title: string };

export interface PublicProject {
  id: string;
  title: string;
  description: string;
  /** "2024-09"; null when not given. */
  startMonth: string | null;
  endMonth: string | null;
  current: boolean;
  skills: string[];
  link: string | null;
  mediaUrls: string[];
  associatedWith: ProjectAssociation | null;
}

/** A stored date as the month it stands for. */
export function monthOf(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 7) : null;
}

/** "2024-09" as the first of that month, UTC. */
export function monthToDate(month: string | null | undefined): Date | null {
  return month ? new Date(`${month}-01T00:00:00.000Z`) : null;
}

/**
 * Which linked services a visitor may follow: those public right now, by the
 * marketplace's own rule. A link to a draft, a removed listing or a paused
 * provider would only lead to "not available".
 */
async function publicServiceIds(prisma: Pick<Prisma.TransactionClient, 'serviceListing'>, projects: ProjectRecord[]): Promise<Set<string>> {
  const ids = [...new Set(projects.flatMap((project) => (project.serviceListingId ? [project.serviceListingId] : [])))];
  if (!ids.length) return new Set();
  const visible = await prisma.serviceListing.findMany({
    where: { AND: [{ id: { in: ids } }, publicServiceWhere()] } as Prisma.ServiceListingWhereInput,
    select: { id: true },
  });
  return new Set(visible.map((listing) => listing.id));
}

function serialize(project: ProjectRecord, ownerUserId: string, followable: (id: string) => boolean): PublicProject {
  const service = project.serviceListing;
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    startMonth: monthOf(project.startDate),
    endMonth: project.current ? null : monthOf(project.endDate),
    current: project.current,
    skills: project.skills,
    link: featuredLink(project.projectUrl),
    // Checked again on the way out, as everywhere media is shown.
    mediaUrls: project.mediaUrls.filter((url) => ownUploadedMedia(url, ownerUserId)),
    associatedWith: project.experience
      ? { kind: 'job', title: project.experience.title, company: project.experience.company }
      : service && followable(service.id) ? { kind: 'service', id: service.id, title: service.title } : null,
  };
}

/** What a visitor sees of these projects. */
export async function publicProjects(
  prisma: Pick<Prisma.TransactionClient, 'serviceListing'>,
  projects: ProjectRecord[],
  ownerUserId: string,
): Promise<PublicProject[]> {
  const followable = await publicServiceIds(prisma, projects);
  return projects.map((project) => serialize(project, ownerUserId, (id) => followable.has(id)));
}

/**
 * The owner's own view: what visitors see, plus what the editor needs — the
 * linked job and service by id, and a linked service named even while it is
 * not public.
 */
export function ownerProject(project: ProjectRecord, ownerUserId: string) {
  return {
    ...serialize(project, ownerUserId, () => true),
    projectUrl: project.projectUrl,
    experienceId: project.experienceId,
    serviceListingId: project.serviceListingId,
  };
}
