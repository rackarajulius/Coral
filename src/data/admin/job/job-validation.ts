import { z } from "zod";

export const screeningQuestionSchema = z
  .string()
  .trim()
  .min(5, "Screening question must be at least 5 characters.")
  .max(200, "Screening question must be under 200 characters.");

export const applicationSettingsSchema = z
  .object({
    applicationMethod: z.enum(["platform", "external"], {
      required_error: "Please select an application method.",
    }),
    externalUrl: z.string().optional(),
    deadline: z.string().optional(),
    screeningQuestions: z.array(screeningQuestionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.applicationMethod === "external") {
      if (!data.externalUrl || data.externalUrl.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "External application URL is required.",
          path: ["externalUrl"],
        });
      } else {
        const url = data.externalUrl.trim();
        if (url.includes("javascript:") || url.includes("localhost")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter a valid secure URL (https://example.com).",
            path: ["externalUrl"],
          });
        } else {
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please enter a valid secure URL (https://example.com).",
                path: ["externalUrl"],
              });
            }
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Please enter a valid secure URL (https://example.com).",
              path: ["externalUrl"],
            });
          }
        }
      }
    }

    if (data.deadline && data.deadline.trim() !== "") {
      const deadlineDate = new Date(data.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(deadlineDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid date.",
          path: ["deadline"],
        });
      } else if (deadlineDate < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Application deadline must be a future date.",
          path: ["deadline"],
        });
      }
    }

    // Check duplicate screening questions
    if (data.screeningQuestions && data.screeningQuestions.length > 0) {
      const seen = new Set<string>();
      data.screeningQuestions.forEach((q, i) => {
        const lower = q.trim().toLowerCase();
        if (seen.has(lower)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate screening question.",
            path: ["screeningQuestions", i],
          });
        }
        seen.add(lower);
      });
    }
  });

export type ApplicationSettingsData = z.infer<typeof applicationSettingsSchema>;

export type ValidationErrors = Record<string, string>;

export function validateApplicationSettings(data: ApplicationSettingsData): ValidationErrors {
  const result = applicationSettingsSchema.safeParse(data);
  if (result.success) return {};
  const errors: ValidationErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
