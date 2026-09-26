import { z } from "zod";

export const contactSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Email address is required" })
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  subject: z
    .string()
    .min(1, { message: "Please select a subject" }),
  message: z
    .string()
    .trim()
    .min(1, { message: "Message is required" })
    .max(2000, { message: "Message must be less than 2,000 characters" }),
  consent: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must agree to the Privacy Policy to submit this form",
    }),
  // Honeypot field - must remain empty
  website: z.string().max(0).optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export const subjectOptions = [
  { value: "technical", label: "Technical Issue" },
  { value: "privacy", label: "Privacy / Data Inquiry" },
  { value: "employer", label: "Employer Verification" },
  { value: "application", label: "Job Application Help" },
  { value: "other", label: "Other" },
] as const;
