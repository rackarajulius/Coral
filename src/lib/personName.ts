import type { User } from "@/lib/api";

/** The fields any name derivation needs. Keeps callers free of the whole User. */
type Named = Pick<User, "firstName" | "lastName" | "displayName" | "email">;

/**
 * The signed-in person's name, or nothing.
 *
 * **Falls back to nothing rather than to something.** `displayName` degrades to
 * the email's local part upstream in AuthContext, so "jsmith1987" would
 * otherwise be presented as this person's name. An empty name is honest, and
 * the surfaces that use this show the email or prompt for a name instead of
 * inventing one.
 *
 * One rule, in one place, because a person's name appears in the sidebar, the
 * profile hero, the interview coach and the share sheet, and those disagreeing
 * is how someone ends up greeted by two different names in one session.
 */
export function personName(user: Named | null | undefined): string {
  if (!user) return "";

  const fromNames = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fromNames) return fromNames;

  const display = user.displayName?.trim() ?? "";
  const emailLocal = user.email?.split("@")[0] ?? "";
  return display && display !== emailLocal ? display : "";
}

/**
 * Up to two letters for an avatar.
 *
 * Derived from the email when no name is known: initials are a label on a
 * coloured circle, not an assertion about what someone is called, so "JS" from
 * "jsmith1987" is fair where "Jsmith1987" as a name would not be. Empty when
 * there is nothing to work from, and the caller draws a neutral icon.
 */
export function personInitials(user: Named | null | undefined): string {
  const name = personName(user);
  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  const emailLocal = user?.email?.split("@")[0] ?? "";
  // Letters only: "j.smith-1987" should read JS, not "J.".
  const letters = emailLocal.replace(/[^a-zA-Z]/g, "");
  return letters.slice(0, 2).toUpperCase();
}
