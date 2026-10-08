import type { User } from "@/contexts/AuthContext";

/**
 * Which side of the product an account belongs to.
 *
 * - `visitor`   — signed out.
 * - `unknown`   — signed in, but the backend hasn't answered yet (a
 *                 provisional user). Never route on this.
 * - `undecided` — a new account that hasn't chosen yet. The backend creates
 *                 every account as a job seeker awaiting onboarding; opening
 *                 the employer pages is how an employer signs up, so these
 *                 accounts may go either way.
 * - `seeker` / `employer` — an account that has chosen.
 * - `admin`     — may use both sides.
 * - `provider`  — legacy freelancer account, with its own provider setup.
 * - `other`     — an unrecognized role; not routed on a guess.
 */
export type AccountSide = "visitor" | "unknown" | "undecided" | "seeker" | "provider" | "employer" | "admin" | "other";

export function accountSide(user: User | null | undefined): AccountSide {
  if (!user) return "visitor";
  if (user.provisional) return "unknown";
  if (user.role === "ADMIN") return "admin";
  // An employer is an employer even before finishing employer setup — that
  // setup lives on the employer side too.
  if (user.role === "EMPLOYER") return "employer";
  if (user.role === "FREELANCER") return "provider";
  if (user.role === "JOB_SEEKER") {
    return user.status === "PENDING_ONBOARDING" ? "undecided" : "seeker";
  }
  return "other";
}

export const SEEKER_ON_EMPLOYER_SIDE =
  "You're signed in as a job seeker. Employer pages need an employer account.";
export const EMPLOYER_ON_SEEKER_SIDE =
  "You're signed in as an employer. Job seeker pages need a job seeker account.";
