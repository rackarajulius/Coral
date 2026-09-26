/**
 * How complete a jobseeker profile is, in one place for the whole server.
 *
 * These weights mirror `COMPLETION_CHECKS` in the frontend's ProfileContext, so
 * the percentage an admin reads is the percentage the candidate is looking at.
 * There were three different answers to this question before: the meter the
 * candidate sees, the admin list (which matched it), and `users.service`, which
 * counted ten unweighted fields — scoring the avatar, splitting the name into
 * three separate points, and ignoring languages, certifications and portfolio
 * entirely. Two of those numbers described the same profile differently.
 *
 * If you change a weight here, change it in ProfileContext too. They are the
 * same promise made to two audiences.
 */

/** The shape both callers can produce, whatever their query returned. */
export interface ProfileCompletionInput {
  name?: string | null;
  headline?: string | null;
  /** Any part of the address counts — city, state or country. */
  location?: string | null;
  summary?: string | null;
  languages?: string[] | null;
  skills?: string[] | null;
  experienceCount?: number;
  educationCount?: number;
  certificationCount?: number;
  portfolioCount?: number;
}

/** Label and weight of each check, for anything that wants to explain the score. */
export const PROFILE_COMPLETION_CHECKS: {
  label: string;
  weight: number;
  passes: (p: ProfileCompletionInput) => boolean;
}[] = [
  { label: 'Name', weight: 10, passes: (p) => !!p.name?.trim() },
  { label: 'Headline', weight: 10, passes: (p) => !!p.headline?.trim() },
  { label: 'Location', weight: 5, passes: (p) => !!p.location?.trim() },
  // 50 characters: a line of text, not a word.
  { label: 'About', weight: 15, passes: (p) => (p.summary?.trim().length ?? 0) >= 50 },
  { label: 'Languages', weight: 5, passes: (p) => (p.languages?.length ?? 0) > 0 },
  { label: 'Experience', weight: 20, passes: (p) => (p.experienceCount ?? 0) > 0 },
  { label: 'Skills', weight: 10, passes: (p) => (p.skills?.length ?? 0) >= 3 },
  { label: 'Education', weight: 10, passes: (p) => (p.educationCount ?? 0) > 0 },
  { label: 'Certifications', weight: 5, passes: (p) => (p.certificationCount ?? 0) > 0 },
  { label: 'Portfolio', weight: 10, passes: (p) => (p.portfolioCount ?? 0) > 0 },
];

/** 0–100. */
export function computeProfileCompletion(input: ProfileCompletionInput): number {
  const total = PROFILE_COMPLETION_CHECKS.reduce((sum, c) => sum + c.weight, 0);
  const earned = PROFILE_COMPLETION_CHECKS.reduce(
    (sum, c) => sum + (c.passes(input) ? c.weight : 0),
    0,
  );
  return Math.round((earned / total) * 100);
}
