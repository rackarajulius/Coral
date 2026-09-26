export interface EmployerFormData {
  // Company Information
  companyName: string;
  companyEmail: string;
  websiteUrl: string;
  companySize: string;
  industry: string;
  foundedYear: string;

  // Company Profile
  description: string;
  country: string;
  province: string;
  city: string;
  remotePolicy: "onsite" | "hybrid" | "remote";

  // Account Owner
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;

  // Account Setup
  passwordMode: "auto" | "manual";
  manualPassword: string;
  sendInviteEmail: boolean;
  emailVerification: "verified" | "require";
  accountStatus: "active" | "pending" | "suspended";

  // Job Posting Permissions
  allowJobPosting: boolean;
  requireApproval: boolean;
  maxActiveJobs: number;
  featuredEmployer: boolean;

  // Compliance
  businessRegNumber: string;
  taxId: string;
  verifiedCompany: boolean;

  // Branding
  logoFile: File | null;
  logoPreview: string;
  coverFile: File | null;
  coverPreview: string;

  // Internal
  internalNotes: string;
  tags: string[];
}

export interface AdminControls {
  markedVerified: boolean;
  markedPremium: boolean;
  flaggedFraud: boolean;
  restrictPosting: boolean;
  sendWelcomeEmail: boolean;
  sendOnboardingGuide: boolean;
  sendPasswordSetupLink: boolean;
  forcePasswordReset: boolean;
  restrictLogin: boolean;
  addInternalAlert: boolean;
}

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
];

export const INDUSTRIES = [
  "Software Development",
  "Healthcare",
  "Finance & Banking",
  "Education",
  "Manufacturing",
  "Retail & E-Commerce",
  "Construction",
  "Transportation & Logistics",
  "Hospitality & Tourism",
  "Media & Entertainment",
  "Energy & Utilities",
  "Government & Public Sector",
  "Non-Profit",
  "Other",
];

export const TAG_OPTIONS = [
  "High Priority",
  "Watchlist",
  "VIP",
  "Needs Review",
  "Partner",
  "Enterprise",
];
