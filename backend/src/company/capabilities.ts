import { CompanyRole } from '@prisma/client';

/**
 * What a company seat is allowed to do.
 *
 * Deliberately coarse. A per-company permission matrix has to be consulted on
 * every employer endpoint and grows a new hole with every feature shipped;
 * a fixed vocabulary can be read in one screen and audited against the routes
 * that use it.
 */
export const CAPABILITIES = [
  'jobs:read',
  'jobs:write',
  /** Applications and candidate profiles — this is the one that carries PII. */
  'candidates:read',
  /** Advance, reject, change pipeline stage. */
  'candidates:write',
  /**
   * Leave internal notes on a candidate — without being able to move them.
   *
   * Split out of `candidates:write` so there is a seat for the people a hire
   * actually depends on: the engineer who ran the technical round, the manager
   * whose team this is. Before this, "let them comment" meant handing them the
   * power to advance and reject, so in practice they were given a Viewer seat
   * and their feedback arrived by email — outside the record of the decision.
   *
   * Tags are deliberately NOT included. A tag is a shared label the team
   * filters and sorts by, so applying one is closer to a decision than to a
   * remark; it stays with `candidates:write`.
   */
  'candidates:comment',
  'messaging:write',
  'interviews:read',
  'interviews:write',
  'analytics:read',
  /** Company profile, branding, public face. */
  'company:write',
  'members:manage',
  'billing:manage',
  'integrations:manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: Capability[] = [...CAPABILITIES];

/**
 * Role → capabilities.
 *
 * Two notes on the narrower seats:
 *
 * - **Viewer** keeps `candidates:read`. Excluding it leaves a seat that can see
 *   job titles and nothing else, which is not a role anyone would assign. The
 *   line that matters for PII is membership of the company, which is approved
 *   deliberately, not the seat within it.
 * - **Interviewer** is not yet narrowed to *assigned* interviews. There is no
 *   assignment on the Interview model to filter by, so this grants interview
 *   access across the company. Narrowing it needs an assignment column, not a
 *   capability — see the note in ROLE_LIMITATIONS.
 *   It now also holds `candidates:comment`, which is what its description
 *   ("leave feedback") had been claiming all along: notes required
 *   `candidates:write`, so the one seat meant for the person who actually met
 *   the candidate could not record a word about them.
 */
export const ROLE_CAPABILITIES: Record<CompanyRole, Capability[]> = {
  [CompanyRole.OWNER]: ALL,
  [CompanyRole.ADMIN]: ALL.filter((c) => c !== 'billing:manage'),
  [CompanyRole.RECRUITER]: [
    'jobs:read',
    'jobs:write',
    'candidates:read',
    'candidates:write',
    'candidates:comment',
    'messaging:write',
    'interviews:read',
    'interviews:write',
    'analytics:read',
  ],
  [CompanyRole.HIRING_MANAGER]: [
    'jobs:read',
    'candidates:read',
    'candidates:write',
    'candidates:comment',
    'messaging:write',
    'interviews:read',
    'interviews:write',
    'analytics:read',
  ],
  [CompanyRole.INTERVIEWER]: [
    'jobs:read',
    'candidates:read',
    'candidates:comment',
    'interviews:read',
    'interviews:write',
  ],
  // Viewer stays genuinely read-only: a note is a contribution to a hiring
  // decision and carries the author's name, which is more than "read".
  [CompanyRole.VIEWER]: ['jobs:read', 'candidates:read', 'analytics:read'],
};

/** Honest record of what a role does *not* yet constrain. Surfaced in the UI. */
export const ROLE_LIMITATIONS: Partial<Record<CompanyRole, string>> = {
  [CompanyRole.INTERVIEWER]:
    'Sees all of the company’s interviews, not only the ones they are running — interviews are not yet assigned to a person.',
};

export function roleHasCapability(role: CompanyRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export const ROLE_LABELS: Record<CompanyRole, string> = {
  [CompanyRole.OWNER]: 'Owner',
  [CompanyRole.ADMIN]: 'Admin',
  [CompanyRole.RECRUITER]: 'Recruiter',
  [CompanyRole.HIRING_MANAGER]: 'Hiring manager',
  [CompanyRole.INTERVIEWER]: 'Interviewer',
  [CompanyRole.VIEWER]: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  [CompanyRole.OWNER]: 'Full access, including billing and removing members.',
  [CompanyRole.ADMIN]: 'Everything except billing.',
  [CompanyRole.RECRUITER]: 'Post jobs, manage candidates and message them.',
  [CompanyRole.HIRING_MANAGER]: 'Review candidates and run interviews. Cannot post jobs.',
  [CompanyRole.INTERVIEWER]:
    'Run interviews and comment on candidates. Cannot move anyone through the pipeline.',
  [CompanyRole.VIEWER]: 'Read-only.',
};
