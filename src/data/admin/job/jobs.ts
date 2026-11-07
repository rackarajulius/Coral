export interface JobTimelineEvent {
  action: string;
  by?: string;
  date: string;
}

/**
 * What the admin jobs page calls each status — the server's AdminJobStatusLabel.
 *
 * These are the schema's own statuses, plus Expired: still marked active but
 * past its deadline, so already hidden from search and due to be archived.
 */
export type AdminJobStatus = "Active" | "Expired" | "Draft" | "Paused" | "Closed" | "Archived";

export const ADMIN_JOB_STATUSES: AdminJobStatus[] = ["Active", "Expired", "Draft", "Paused", "Closed", "Archived"];

/** The statuses an admin can set. Draft and Expired are never set by hand. */
export type AdminSettableJobStatus = "Active" | "Paused" | "Closed" | "Archived";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract" | "Internship";
  salaryMin?: number;
  salaryMax?: number;
  salaryUnit?: string;
  currency?: string;
  postedDate: string;
  applications: number;
  status: AdminJobStatus;
  /** The application deadline is behind us, whatever the status says. */
  deadlinePassed?: boolean;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  industry?: string;
  expiryDate?: string;
  timeline?: JobTimelineEvent[];
}
