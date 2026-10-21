import { Briefcase, FileText, Sparkles, UserRound } from "lucide-react";
import type { FormData, StepDef } from "./types";

export const STEPS: StepDef[] = [
  { id: 1, title: "Create Profile", description: "Build your professional identity.", icon: UserRound },
  { id: 2, title: "Career Preferences", description: "Tell us your ideal opportunities.", icon: Briefcase },
  { id: 3, title: "Skills & Resume", description: "Highlight your experience and strengths.", icon: FileText },
  { id: 4, title: "Job Interests", description: "Choose industries and career paths.", icon: Sparkles },
];

/* Page header copy shown above each step's form. */
export const STEP_META: { title: string; description: string }[] = [
  {
    title: "Create your professional profile",
    description:
      "Set up your account so recruiters can discover you and tailor job recommendations based on your skills and career goals.",
  },
  {
    title: "Set your career preferences",
    description:
      "Tell us what opportunities you're looking for so we can personalize your experience.",
  },
  {
    title: "Showcase your skills",
    description: "Upload your resume and we'll fill in your experience for you.",
  },
  {
    title: "Choose industries and interests",
    description:
      "Select industries and roles you're interested in to improve recommendations.",
  },
];

export const initialData: FormData = {
  fullName: "",
  email: "",
  headline: "",
  location: "",
  locationParts: null,
  countryHint: "",
  years: "",
  level: "",
  workEligibility: "",
  workPermitExpiry: "",
  jobTitle: "",
  workTypes: [],
  employment: [],
  salaryMin: "",
  salaryMax: "",
  locations: [],
  resume: null,
  parsed: null,
  skills: [],
  industries: [],
};

export const DEFAULT_INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "E-Commerce",
  "Artificial Intelligence",
  "Cybersecurity",
  "Design",
];
