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

/**
 * Whether this person may open the company dashboard.
 *
 * One account does everything, as on LinkedIn, so this is not the account
 * type alone: an employer account (including one still setting up its
 * company), an admin, or anyone holding an active seat on a company team.
 * Everyone signed in has a personal side; this is the company side.
 */
export function actsForCompany(user: User | null | undefined): boolean {
  const side = accountSide(user);
  return side === "employer" || side === "admin" || !!user?.company;
}

/** The name to show for the company someone acts for, when it is known. */
export function companyLabel(user: User | null | undefined): string {
  return user?.company?.name?.trim() || "Your company";
}
