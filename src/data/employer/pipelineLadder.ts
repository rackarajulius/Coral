/**
 * The one pipeline ladder, mirrored from the backend.
 *
 * Kept in a single file because the sourced board and the applicant board used
 * to define their own stages, which meant the same hire read differently
 * depending on which screen you opened. See backend/src/common/pipeline-stage.ts
 * — that is the enforced version; this is only the presentation of it.
 */
export const PIPELINE_STAGES = [
  "SOURCED",
  "CONTACTED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

/**
 * The rungs, in order. Exits are excluded: they are outcomes, not progress.
 *
 * REJECTED is still a column on the board — a recruiter needs somewhere to put
 * people — but it sits outside the ladder so nothing treats it as "further
 * along than Interview". WITHDRAWN never appears as a column, because it is the
 * candidate's own act and an employer cannot move someone into it.
 */
export const LADDER: PipelineStageId[] = [
  "SOURCED",
  "CONTACTED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
];

export const STAGE_LABELS: Record<PipelineStageId, string> = {
  SOURCED: "Sourced",
  CONTACTED: "Contacted",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/** One palette for both boards, so a stage looks the same wherever it appears. */
export const STAGE_COLOURS: Record<
  PipelineStageId,
  { dotColor: string; bgColor: string; textColor: string }
> = {
  SOURCED: {
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  CONTACTED: {
    dotColor: "bg-violet-500",
    bgColor: "bg-violet-500/10",
    textColor: "text-violet-600 dark:text-violet-400",
  },
  APPLIED: {
    dotColor: "bg-sky-500",
    bgColor: "bg-sky-500/10",
    textColor: "text-sky-600 dark:text-sky-400",
  },
  SCREENING: {
    dotColor: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  INTERVIEW: {
    dotColor: "bg-orange-500",
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  OFFER: {
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  HIRED: {
    dotColor: "bg-teal-500",
    bgColor: "bg-teal-500/10",
    textColor: "text-teal-600 dark:text-teal-400",
  },
  REJECTED: {
    dotColor: "bg-muted-foreground",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
  },
  WITHDRAWN: {
    dotColor: "bg-muted-foreground",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
  },
};

/** Position on the ladder, or -1 for an exit. */
export const ladderIndex = (stage: PipelineStageId | null): number =>
  stage ? LADDER.indexOf(stage) : -1;
