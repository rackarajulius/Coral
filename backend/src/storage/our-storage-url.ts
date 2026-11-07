/**
 * Whether a URL is on our own Supabase storage host.
 *
 * Checked alongside the path: a look-alike path on another site must not pass
 * for one of our files, or a picture "of the work" could be a page that
 * learns who looked at it. Without SUPABASE_URL (unit tests) only the path is
 * checked.
 */
export function isOurStorageHost(url: URL): boolean {
  const base = process.env.SUPABASE_URL;
  if (!base) return true;
  try {
    return new URL(base).origin === url.origin;
  } catch {
    return false;
  }
}
