/** The fields a name is made from. */
export interface NamedPerson {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

/**
 * What to call someone when showing them to other people: their first and
 * last name, then the display name, then the caller's fallback ("Someone",
 * "Member").
 *
 * Names first — the web app's `personName` rule, so a person is called the
 * same thing in the bell as on the page. A display name is set once (at
 * sign-up, or from the name given at onboarding) and goes stale when they
 * change their name; older email sign-ups were also given the email's local
 * part as one, which is neither a name nor something to publish.
 */
export function personName(person: NamedPerson | null | undefined, fallback: string): string {
  return (
    [person?.firstName, person?.lastName].map((part) => part?.trim()).filter(Boolean).join(' ') ||
    person?.displayName?.trim() ||
    fallback
  );
}
