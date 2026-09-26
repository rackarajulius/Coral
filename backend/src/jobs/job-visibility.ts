/**
 * Who may read a job, and which parts of it.
 *
 * Public job surfaces (the listing, the job page) show live jobs only — see
 * LIVE_JOB_STATUSES. A job that isn't live — draft, paused, closed, archived —
 * is visible to the company that posted it, to admins, and to people who
 * applied to it; to everyone else it does not exist (404, never 403, so its
 * existence isn't confirmed).
 */

/**
 * Job columns left out of every candidate- and public-facing read.
 *
 * The employer's AI-screening question set is fixed per job so every
 * candidate is asked the same thing. Seeing it in advance would let someone
 * prepare exact answers — or have them written — which defeats the comparison
 * the screening exists for. The questions reach a candidate only inside their
 * own screening, when they take it.
 */
export const PRIVATE_JOB_FIELDS = {
  screeningQuestions: true,
  screeningGeneratedAt: true,
} as const;
