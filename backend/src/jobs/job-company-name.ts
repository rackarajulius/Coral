import { seatPage, shownProfile } from '../company/company-page';

/**
 * The company a job is shown under.
 *
 * `Job.companyName` is only filled when an admin posts a job with no employer
 * account behind it. An ordinary posting takes its name from the posting
 * employer's company page, which is what the job page shows — the page of the
 * poster's company, not the poster's own copy of it. Reading the job's own
 * field alone left research, tailoring and fit scoring with no company at all
 * for ordinary postings.
 *
 * The job's own name comes first, as on the job page: it is set for that one
 * job on purpose.
 */
export function jobCompanyName(job: {
  companyName?: string | null;
  postedBy?: {
    employerProfile?: { companyName?: string | null } | null;
    companyMemberships?: Array<{ company: { page: { companyName?: string | null } | null } | null }>;
  } | null;
}): string | null {
  return job.companyName?.trim() || shownProfile(job.postedBy)?.companyName?.trim() || null;
}

/** What {@link jobCompanyName} reads, to spread into a job query's `select`. */
export const JOB_COMPANY_SELECT = {
  companyName: true,
  postedBy: {
    select: {
      employerProfile: { select: { companyName: true } },
      ...seatPage({ companyName: true }),
    },
  },
} as const;
