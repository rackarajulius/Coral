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
  plan: "Free" | "Pro" | "Enterprise";
  joinedDate: string;
  lastActive: string;
  email: string;
  website: string;
  companySize: string;
  billingStatus: string;
}
