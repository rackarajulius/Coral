/** Account status, one label per stored status (server: STATUS_LABEL). */
export type JobseekerStatus = "Active" | "Onboarding" | "Inactive" | "Suspended" | "Banned";

export const JOBSEEKER_STATUSES: JobseekerStatus[] = ["Active", "Onboarding", "Inactive", "Suspended", "Banned"];

export interface Jobseeker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  avatar: string; // initials
  applications: number;
  savedJobs: number;
  profileCompletion: number; // 0-100
  lastActive: string;
  signupDate: string;
  status: JobseekerStatus;
  /**
   * Open reports about things they wrote, across posts, comments, reviews,
   * listings and marketplace requests. A count of facts — there is no risk
   * score, by design (see ModerationRecordService on the server).
   */
  openReports: number;
  isPremium: boolean;
  isVerified: boolean;
  // detail fields
  /** Interviews proposed, confirmed or completed — not declined or cancelled. */
  interviews?: number;
  offers?: number;
  /** The résumé on file; null when there is none. Opened via getJobseekerResumeLink. */
  resume?: { fileName: string | null; uploadedAt: string | null } | null;
  timeline?: { event: string; date: string }[];
  applicationHistory?: { job: string; company: string; status: string; date: string }[];
}
