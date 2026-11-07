/**
 * Reading places as people and job postings write them. No city list needed,
 * so anything can use these without the locations module.
 */

/** "Toronto, ON" → "Toronto"; the part a place-name match needs. */
export function cityOf(location: string): string {
  return location.split(',')[0].trim();
}

/** "Remote", "remote ", "Remote work" — a wish for remote work rather than a place. */
export function meansRemote(location: string): boolean {
  return /^\s*remote\b/i.test(location);
}
