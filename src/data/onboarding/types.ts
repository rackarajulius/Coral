import type { LucideIcon } from "lucide-react";
import type { ParsedResume } from "@/lib/api/jobSeekerProfile";
import type { LocationParts } from "@/lib/location/places";

export type FormData = {
  fullName: string;
  email: string;
  headline: string;
  /** What is in the location box. */
  location: string;
  /** The picked city's columns, when one was picked; cleared by typing. */
  locationParts: LocationParts | null;
  /** The country the CDN reports (ISO code), used to rank city suggestions. */
  countryHint: string;
  years: string;
  level: string;
  workEligibility: string;
  workPermitExpiry: string;
  jobTitle: string;
  workTypes: string[];
  employment: string[];
  salaryMin: string;
  salaryMax: string;
  /** Preferred places: picked cities ("Toronto, ON") or typed ones ("Remote"). */
  locations: string[];
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
