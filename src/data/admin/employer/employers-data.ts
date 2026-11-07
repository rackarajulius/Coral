export interface Employer {
  id: string;
  company: string;
  logo: string;
  logoUrl?: string | null;
  industry: string;
  location: string;
  jobsPosted: number;
  activeJobs: number;
  expiredJobs: number;
  applicationsReceived: number;
  status: "verified" | "pending" | "suspended" | "banned" | "flagged";
  /** Their company's plan (Starter, Pro, Enterprise); null with no active company seat. */
  plan: string | null;
  joinedDate: string;
  lastActive: string;
  email: string;
  website: string;
  companySize: string;
  billingStatus: string;
}
