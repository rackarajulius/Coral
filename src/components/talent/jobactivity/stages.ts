import type { AppStatus } from '@/data/jobactivity/job-activity-mock';

export const STAGES = ['Applied', 'Under Review', 'Interview', 'Offer', 'Hired'] as const;

export type ProgressTone = 'active' | 'rejected' | 'withdrawn';

export interface AppProgress {
  /** Index into STAGES of the current stage, or -1 for a closed application. */
  index: number;
  label: string;
  tone: ProgressTone;
}

const STAGE_INDEX: Record<AppStatus, number> = {
  applied: 0,
  viewed: 0,
  under_review: 1,
  assessment: 1,
  shortlisted: 1,
  interview_scheduled: 2,
  interview_completed: 2,
  offer: 3,
  hired: 4,
  rejected: -1,
  withdrawn: -1,
};

export function applicationProgress(status: AppStatus): AppProgress {
  if (status === 'rejected') return { index: -1, label: 'Rejected', tone: 'rejected' };
  if (status === 'withdrawn') return { index: -1, label: 'Withdrawn', tone: 'withdrawn' };
  const index = STAGE_INDEX[status];
  return { index, label: STAGES[index], tone: 'active' };
}
