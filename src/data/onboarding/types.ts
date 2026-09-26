import type { LucideIcon } from "lucide-react";
import type { ParsedResume } from "@/lib/api/jobSeekerProfile";

export type FormData = {
  fullName: string;
  email: string;
  headline: string;
  location: string;
  years: string;
  level: string;
  workEligibility: string;
  workPermitExpiry: string;
  jobTitle: string;
  workTypes: string[];
  employment: string[];
  salaryMin: string;
  salaryMax: string;
  locations: string;
  resume: { name: string; size: number; uploadedAt: Date } | null;
  /** Structured data extracted from the uploaded resume. */
  parsed: ParsedResume | null;
  skills: string[];
  industries: string[];
};

export type StepDef = {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
};
