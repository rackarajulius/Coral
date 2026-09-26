import type { ParsedResume } from '@/lib/api/jobSeekerProfile';

/**
 * Carries a resume parse across the hop from onboarding to the profile.
 *
 * Onboarding used to write the parsed roles and degrees straight into the
 * profile — invisibly, since that step only ever displayed the word "Parsed".
 * Whatever the model read became the user's work history without them seeing
 * it, and a misread employer or date landed as fact.
 *
 * Now onboarding leaves the parse here and the profile picks it up, opening
 * the same review dialog a later upload opens. One reviewed path instead of
 * two behaviours.
 *
 * localStorage rather than state because onboarding finishes with a full page
 * navigation (deliberately — it forces the auth and profile contexts to
 * rehydrate). Read once and cleared, so a refresh does not ask again.
 */
const KEY = 'jobseeker_resume_import_v1';

export function stashResumeImport(parsed: ParsedResume): void {
  try {
    // Nothing worth reviewing means nothing worth stashing.
    if (!parsed?.experiences?.length && !parsed?.educations?.length) return;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {
    // A browser refusing storage just means no review prompt; the resume
    // itself is already saved server-side either way.
  }
}

/** Returns the stashed parse and removes it. Null when there is none. */
export function takeStashedResumeImport(): ParsedResume | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as ParsedResume;
    return parsed?.experiences || parsed?.educations ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Drops any waiting parse. Run when a session ends: a stash left by one person
 * must never be offered to whoever signs in next on this browser.
 */
export function clearResumeImportStash(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored is nothing to clear.
  }
}
