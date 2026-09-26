import { Prisma } from '@prisma/client';
import { MatchJob, MatchProfile } from './job-match.rules';

/**
 * The columns matching reads, in one place, so the feed, the fan-out and the
 * attribution paths cannot quietly score on different inputs.
 */
export const PROFILE_MATCH_SELECT = {
  userId: true,
  skills: true,
  keywords: true,
  headline: true,
  currentTitle: true,
  jobTypes: true,
  experienceLevel: true,
  city: true,
  state: true,
  country: true,
  preferredLocations: true,
  remoteWork: true,
  remotePreference: true,
  willingToRelocate: true,
  openToWork: true,
  updatedAt: true,
} satisfies Prisma.JobSeekerProfileSelect;

export type ProfileRow = Prisma.JobSeekerProfileGetPayload<{ select: typeof PROFILE_MATCH_SELECT }>;

export const JOB_MATCH_SELECT = {
  id: true,
  title: true,
  skills: true,
  experienceLevel: true,
  employmentType: true,
  location: true,
  isRemote: true,
  isHybrid: true,
  postedById: true,
  publishedAt: true,
  createdAt: true,
  companyName: true,
  companyLogo: true,
  postedBy: {
    select: { employerProfile: { select: { companyName: true, companyLogo: true } } },
  },
} satisfies Prisma.JobSelect;

export type JobRow = Prisma.JobGetPayload<{ select: typeof JOB_MATCH_SELECT }>;

export function toMatchProfile(p: ProfileRow): MatchProfile {
  return {
    skills: p.skills ?? [],
    keywords: p.keywords ?? [],
    headline: p.headline,
    currentTitle: p.currentTitle,
    jobTypes: p.jobTypes ?? [],
    experienceLevel: p.experienceLevel,
    city: p.city,
    state: p.state,
    country: p.country,
    preferredLocations: p.preferredLocations ?? [],
    remoteWork: p.remoteWork,
    remotePreference: p.remotePreference,
    willingToRelocate: p.willingToRelocate,
  };
}

export function toMatchJob(j: JobRow): MatchJob {
  return {
    title: j.title,
    skills: j.skills ?? [],
    experienceLevel: j.experienceLevel,
    employmentType: j.employmentType,
    location: j.location,
    isRemote: j.isRemote,
    isHybrid: j.isHybrid,
  };
}

/** An admin's manual override names a company with no account; otherwise the poster's. */
export function companyOf(j: JobRow): { name: string; logo: string | null } {
  return {
    name: j.companyName || j.postedBy?.employerProfile?.companyName || 'Company',
    logo: j.companyLogo || j.postedBy?.employerProfile?.companyLogo || null,
  };
}

/** True when the profile says enough about the person to match anything to them. */
export function profileHasSignal(p: ProfileRow): boolean {
  return (
    (p.skills?.length ?? 0) > 0 ||
    (p.keywords?.length ?? 0) > 0 ||
    !!p.currentTitle?.trim() ||
    !!p.headline?.trim()
  );
}
