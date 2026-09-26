import { z } from "zod";
import { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";

// ─── Zod Schema ───────────────────────────────────────────────
export const editJobSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    location: z.string().min(2, "Location is required"),
    jobType: z.string().min(1, "Job type is required"),
    workArrangement: z.string().min(1, "Work arrangement is required"),
    department: z.string().min(1, "Department is required"),
    experienceLevel: z.string().min(1, "Experience level is required"),
    description: z.string().min(50, "Description must be at least 50 characters"),
    skills: z.array(z.object({ value: z.string().min(1) })).min(1, "Add at least one skill"),
    salaryMin: z.coerce.number().min(0, "Must be positive"),
    salaryMax: z.coerce.number().min(0, "Must be positive"),
    currency: z.string().min(1),
    payType: z.string().min(1),
    benefits: z.array(z.object({ value: z.string().min(1) })),
    applicationDeadline: z.date().optional(),
    applicationMethod: z.string().min(1),
    applicationUrl: z.string().optional(),
    applicationEmail: z.string().optional(),
    status: z.enum(["open", "draft", "closed"]),
  })
  .refine((d) => d.salaryMax >= d.salaryMin, {
    message: "Max salary must be ≥ min salary",
    path: ["salaryMax"],
  })
  .refine(
    (d) => {
      if (d.applicationMethod !== "external") return true;
      if (!d.applicationUrl) return false;
      try { new URL(d.applicationUrl); return true; } catch { return false; }
    },
    { message: "Enter a valid URL (e.g. https://example.com/apply)", path: ["applicationUrl"] }
  )
  .refine(
    (d) => {
      if (d.applicationMethod !== "email") return true;
      if (!d.applicationEmail) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.applicationEmail);
    },
    { message: "Enter a valid email address for applications", path: ["applicationEmail"] }
  );

export type EditJobForm = z.infer<typeof editJobSchema>;

export type EditJobFormReturn = UseFormReturn<EditJobForm>;

export type FieldArrayItem = { id: string; value?: string };

export interface DynamicFieldProps {
  fields: FieldArrayItem[];
  append: UseFieldArrayReturn<EditJobForm>["append"];
  remove: UseFieldArrayReturn<EditJobForm>["remove"];
}

// ─── Mock data ────────────────────────────────────────────────
export const mockJob: EditJobForm = {
  title: "Senior Frontend Engineer",
  location: "San Francisco, CA",
  jobType: "full-time",
  workArrangement: "hybrid",
  department: "Engineering",
  experienceLevel: "senior",
  description:
    "We are looking for a Senior Frontend Engineer to join our team and help build the next generation of our product. You will work closely with designers, product managers, and backend engineers to deliver exceptional user experiences.\n\nResponsibilities:\n• Lead frontend architecture decisions\n• Mentor junior developers\n• Build performant, accessible components\n• Collaborate on design systems\n\nRequirements:\n• 5+ years of experience with React/TypeScript\n• Strong understanding of web performance\n• Experience with modern CSS (Tailwind, CSS-in-JS)\n• Excellent communication skills",
  skills: [
    { value: "React" },
    { value: "TypeScript" },
    { value: "Tailwind CSS" },
    { value: "Next.js" },
    { value: "GraphQL" },
  ],
  salaryMin: 150000,
  salaryMax: 220000,
  currency: "USD",
  payType: "yearly",
  benefits: [
    { value: "Health Insurance" },
    { value: "401(k) Match" },
    { value: "Unlimited PTO" },
    { value: "Remote Work" },
    { value: "Learning Budget" },
  ],
  applicationDeadline: new Date("2025-06-30"),
  applicationMethod: "internal",
  applicationUrl: "",
  applicationEmail: "",
  status: "open",
};

export const suggestedSkills = [
  "Redux", "Vue.js", "Node.js", "REST APIs", "Jest", "Cypress",
  "Figma", "Storybook", "Webpack", "Vite", "Docker", "CI/CD",
  "Accessibility", "Performance Optimization", "Design Systems",
];

export const suggestedBenefits = [
  "Equity/Stock Options", "Home Office Stipend", "Gym Membership",
  "Parental Leave", "Mental Health Support", "Free Lunch",
  "Conference Budget", "Sabbatical Leave", "Commuter Benefits",
  "Pet-Friendly Office", "Childcare Assistance", "Dental Insurance",
];

export const statusConfig = {
  open: { label: "Open", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  draft: { label: "Draft", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  closed: { label: "Closed", className: "bg-secondary text-muted-foreground" },
};
