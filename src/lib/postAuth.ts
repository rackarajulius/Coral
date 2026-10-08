import type { User } from "@/contexts/AuthContext";

/** Single source of truth for where a user lands after a plain sign-in. */
export function resolvePostAuthPath(user: User): string | null {
  if (user.role === "ADMIN") return "/admin/dashboard";
  if (!user.provisional && user.role === "FREELANCER") return "/provider";
  // Everyone else stays on the page they signed in from.
  return null;
}
