import { PipelineStage } from '@prisma/client';

/**
 * Where someone is with a company — one ladder, whichever way they arrived.
 *
 * There used to be two, which meant the same hire looked different depending on
 * which screen you opened. Sourced candidates ran
 * `new → contacted → screening → interview → offer` and could not be marked
 * hired or rejected at all; applicants ran off `Application.status`
 * (`pending → reviewing → … → hired`). A person you found and then received an
 * application from became two unconnected cards on two boards.
 *
 * Now there is one ladder with two entry points. A sourced candidate starts at
 * `SOURCED`; an applicant starts at `APPLIED`; everything after that is shared.
 * `APPLIED` sits in the middle deliberately — receiving an application from
 * someone you approached is progress, not a restart.
 *
 * `Application.status` stays the stored truth for applicants and this is derived
 * from it. A second column holding the stage would have to agree with the first,
 * and sooner or later it would not.
 */
export const PIPELINE_LADDER: PipelineStage[] = [
  PipelineStage.SOURCED,
  PipelineStage.CONTACTED,
  PipelineStage.APPLIED,
  PipelineStage.SCREENING,
  PipelineStage.INTERVIEW,
  PipelineStage.OFFER,
  PipelineStage.HIRED,
];

/**
 * Not on the ladder: these are exits, not rungs.
 *
 * Ordering them against the rest would imply that being rejected is further
 * along than being interviewed, and any "furthest stage wins" comparison would
 * then treat a rejection as an advance.
 */
export const PIPELINE_EXITS: PipelineStage[] = [PipelineStage.REJECTED, PipelineStage.WITHDRAWN];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  [PipelineStage.SOURCED]: 'Sourced',
  [PipelineStage.CONTACTED]: 'Contacted',
  [PipelineStage.APPLIED]: 'Applied',
  [PipelineStage.SCREENING]: 'Screening',
  [PipelineStage.INTERVIEW]: 'Interview',
  [PipelineStage.OFFER]: 'Offer',
  [PipelineStage.HIRED]: 'Hired',
  [PipelineStage.REJECTED]: 'Rejected',
  [PipelineStage.WITHDRAWN]: 'Withdrawn',
};

/**
 * `Application.status` → the shared ladder.
 *
 * `shortlisted` maps to SCREENING rather than to a rung of its own: on an
 * application it means someone has read it and kept it, which is what screening
 * is. It is not the same thing as being on a sourcing shortlist.
 */
const STAGE_BY_STATUS: Record<string, PipelineStage> = {
  pending: PipelineStage.APPLIED,
  reviewing: PipelineStage.SCREENING,
  shortlisted: PipelineStage.SCREENING,
  interviewing: PipelineStage.INTERVIEW,
  offered: PipelineStage.OFFER,
  hired: PipelineStage.HIRED,
  rejected: PipelineStage.REJECTED,
  withdrawn: PipelineStage.WITHDRAWN,
};

/** The status to store when a move is made on the shared ladder. */
const STATUS_BY_STAGE: Partial<Record<PipelineStage, string>> = {
  [PipelineStage.APPLIED]: 'pending',
  [PipelineStage.SCREENING]: 'reviewing',
  [PipelineStage.INTERVIEW]: 'interviewing',
  [PipelineStage.OFFER]: 'offered',
  [PipelineStage.HIRED]: 'hired',
  [PipelineStage.REJECTED]: 'rejected',
};

export function stageFromApplicationStatus(status: string): PipelineStage {
  return STAGE_BY_STATUS[status?.toLowerCase()] ?? PipelineStage.APPLIED;
}

/**
 * The status for a stage, or null where there is no honest equivalent.
 *
 * `SOURCED` and `CONTACTED` happen before there is an application, so moving a
 * linked candidate back to them cannot be expressed as a status — null tells
 * the caller to leave the application alone rather than invent something.
 * `WITHDRAWN` is the candidate's own act and is never set by an employer move.
 */
export function statusForStage(stage: PipelineStage): string | null {
  return STATUS_BY_STAGE[stage] ?? null;
}

/**
 * Application counts per status, folded up into pipeline stages.
 *
 * Every "applications by stage" breakdown used to group on the legacy
 * `applications.stage` column, which held "Application Sent" for everyone — so
 * the breakdown was a single bar reporting how many applications there were.
 * Shared rather than copied into each analytics service, because three of them
 * were computing the same thing three slightly different ways.
 *
 * Ordered by the ladder, not by size: this is read as a funnel, and sorting by
 * count would shuffle the rungs out of sequence.
 */
export function stagesFromStatuses(
  rows: Array<{ status: string; _count: { _all: number } }>,
): Array<{ stage: string; count: number }> {
  const counts = new Map<PipelineStage, number>();
  for (const row of rows) {
    const stage = stageFromApplicationStatus(row.status);
    counts.set(stage, (counts.get(stage) ?? 0) + row._count._all);
  }
  return [...PIPELINE_LADDER, ...PIPELINE_EXITS]
    .filter((stage) => counts.has(stage))
    .map((stage) => ({ stage: PIPELINE_STAGE_LABELS[stage], count: counts.get(stage) ?? 0 }));
}

/** Position on the ladder, or -1 for an exit. */
export function ladderIndex(stage: PipelineStage | null): number {
  if (!stage) return -1;
  return PIPELINE_LADDER.indexOf(stage);
}

/**
 * True when `candidate` is further along than `current`.
 *
 * Exits never count as further along, so linking an application to a shortlist
 * item cannot quietly promote a rejection into the pipeline.
 */
export function isFurtherAlong(candidate: PipelineStage, current: PipelineStage | null): boolean {
  // An exit scores -1, which cannot be greater than any rung and cannot beat
  // another -1 either, so the comparison alone is enough. An explicit guard
  // here would look protective while never once changing the answer.
  return ladderIndex(candidate) > ladderIndex(current);
}

/**
 * Words that name a stage, and would contradict it as a tag.
 *
 * Status lives in the stage; tags are for everything else ("strong referral",
 * "relocating", "visa needed"). A candidate tagged "Interviewed" whose stage
 * says Screening tells the team two different things, and only one of them —
 * the stage — is what the candidate sees in their own tracker. So a label that
 * is just a stage name is refused and pointed at the stage.
 *
 * Only whole labels match: "interview-ready" and "offer negotiation" say
 * something a stage does not, and stay allowed.
 */
const STAGE_WORDS: Record<string, PipelineStage> = {
  sourced: PipelineStage.SOURCED,
  contacted: PipelineStage.CONTACTED,
  applied: PipelineStage.APPLIED,
  screening: PipelineStage.SCREENING,
  screened: PipelineStage.SCREENING,
  reviewing: PipelineStage.SCREENING,
  reviewed: PipelineStage.SCREENING,
  shortlist: PipelineStage.SCREENING,
  shortlisted: PipelineStage.SCREENING,
  'short list': PipelineStage.SCREENING,
  'short listed': PipelineStage.SCREENING,
  interview: PipelineStage.INTERVIEW,
  interviews: PipelineStage.INTERVIEW,
  interviewing: PipelineStage.INTERVIEW,
  interviewed: PipelineStage.INTERVIEW,
  offer: PipelineStage.OFFER,
  offered: PipelineStage.OFFER,
  hired: PipelineStage.HIRED,
  rejected: PipelineStage.REJECTED,
  declined: PipelineStage.REJECTED,
  withdrawn: PipelineStage.WITHDRAWN,
};

/**
 * Why a tag label should be a stage instead, or null when it is a fine tag.
 * The message is shown to the recruiter as written.
 */
export function stageInsteadOfTag(label: string): string | null {
  const word = label
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const stage = STAGE_WORDS[word];
  if (!stage) return null;

  const name = PIPELINE_STAGE_LABELS[stage];
  if (stage === PipelineStage.WITHDRAWN) {
    return `"${label.trim()}" is a stage the candidate sets themselves by withdrawing, so it can't be a tag.`;
  }
  const extra = word.startsWith('short') ? ', or save them to a project' : '';
  return `"${label.trim()}" is a pipeline stage — move them to ${name}${extra} instead, so the board, your team and the candidate's own tracker agree. Use tags for everything else, like "strong referral".`;
}
