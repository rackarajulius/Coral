export type RiskLevel = "Low" | "Medium" | "High";

export type JobseekerStatus = "Active" | "Inactive" | "Suspended" | "Flagged" | "Deleted";

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
  risk: RiskLevel;
  riskScore: number; // 0-100
  isPremium: boolean;
  isVerified: boolean;
  resumeFile?: string;
  // detail fields
  /** Interviews proposed, confirmed or completed — not declined or cancelled. */
  interviews?: number;
  offers?: number;
  /** The résumé on file; null when there is none. Opened via getJobseekerResumeLink. */
  resume?: { fileName: string | null; uploadedAt: string | null } | null;
  reportsReceived?: number;
  suspiciousFlags?: number;
  timeline?: { event: string; date: string }[];
  applicationHistory?: { job: string; company: string; status: string; date: string }[];
}
