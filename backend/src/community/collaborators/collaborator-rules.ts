import { PostCollaboratorStatus } from '@prisma/client';

/**
 * Who may be invited onto a post as a collaborator, as on LinkedIn — kept
 * apart from the database so the rules can be read, and tested, in one place.
 *
 * - **A person** the author follows, or who follows the author: Coral's
 *   nearest thing to LinkedIn's "connections". It keeps invitations to people
 *   who have had something to do with the author. They must also allow
 *   collaboration invites (`User.allowCollaborations`).
 * - **A company page** that is live (not private, not deactivated) and belongs
 *   to a company, whose owners and admins answer for it. Not the company the
 *   post already speaks for.
 * - **At most five** at once, pending and accepted together.
 * - **Never twice:** someone who declined or left a post is not asked again
 *   by that post. Removed by the author, they may be.
 */

/** Most collaborators one post may have, pending and accepted together. */
export const MAX_COLLABORATORS = 5;

/** The notification type of invitations and acceptances. */
export const COLLABORATION_NOTIFICATION = 'collaboration';

export type CollaboratorKind = 'person' | 'company';

/** As the page sends them: a person by user id, a company by its page's id (as @mentions name it). */
export interface CollaboratorRef {
  kind: CollaboratorKind;
  id: string;
}

export interface PersonCandidate {
  kind: 'person';
  userId: string;
  name: string;
  /** Not closed, suspended or barred. */
  active: boolean;
  allowsInvites: boolean;
  /** The author follows them, or they follow the author. */
  related: boolean;
}

export interface CompanyCandidate {
  kind: 'company';
  pageId: string;
  /** The company the page belongs to; null for a page that belongs to none. */
  companyId: string | null;
  name: string;
  /** Not private and not deactivated. */
  live: boolean;
}

export type Candidate = PersonCandidate | CompanyCandidate;

export interface ExistingCollaborator {
  userId: string | null;
  companyId: string | null;
  status: PostCollaboratorStatus;
}

export const refKey = (ref: CollaboratorRef) => `${ref.kind}:${ref.id.toLowerCase()}`;

/** The same person or company, whichever row or candidate it is. */
const identity = (c: Candidate | ExistingCollaborator): string =>
  'kind' in c
    ? c.kind === 'person' ? `user:${c.userId}` : `company:${c.companyId}`
    : c.userId ? `user:${c.userId}` : `company:${c.companyId}`;

const isActive = (row: ExistingCollaborator) =>
  row.status === PostCollaboratorStatus.PENDING || row.status === PostCollaboratorStatus.ACCEPTED;

/** Why this one can't be invited onto this post, said to the author; null when they can. */
export function refusal(
  candidate: Candidate | undefined,
  context: { authorId: string; postCompanyId: string | null; existing: ExistingCollaborator[] },
): string | null {
  if (!candidate) return 'One of the people or pages you picked is no longer on Coral.';
  if (candidate.kind === 'person') {
    if (candidate.userId === context.authorId) return "You can't invite yourself.";
    if (!candidate.active) return `${candidate.name} can't be invited.`;
    if (!candidate.allowsInvites) return `${candidate.name} doesn't take collaboration invites.`;
    if (!candidate.related) {
      return `You can invite people you follow or who follow you, and ${candidate.name} isn't one of them.`;
    }
  } else {
    if (!candidate.live || !candidate.companyId) return `${candidate.name} can't collaborate on posts.`;
    if (candidate.companyId === context.postCompanyId) return `This post is already ${candidate.name}'s.`;
  }
  const before = context.existing.find((row) => identity(row) === identity(candidate));
  if (before?.status === PostCollaboratorStatus.DECLINED) return `${candidate.name} declined this post, so it can't ask again.`;
  if (before?.status === PostCollaboratorStatus.LEFT) return `${candidate.name} left this post, so it can't ask again.`;
  return null;
}

/**
 * From the collaborators a post has to the ones the author now wants: who is
 * newly invited and who is taken off. Anyone kept keeps their place — an
 * accepted collaborator is not asked again. Duplicates count once.
 */
export function planCollaborators(
  wanted: Candidate[],
  existing: ExistingCollaborator[],
): { add: Candidate[]; remove: ExistingCollaborator[]; total: number } {
  const current = existing.filter(isActive);
  const unique = new Map<string, Candidate>();
  for (const candidate of wanted) unique.set(identity(candidate), candidate);
  const add = [...unique.values()].filter((c) => !current.some((row) => identity(row) === identity(c)));
  const remove = current.filter((row) => !unique.has(identity(row)));
  return { add, remove, total: unique.size };
}
