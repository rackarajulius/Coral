/**
 * The link under a call-to-action button, as the composer checks it before the
 * server does (post-cta.ts on the server has the last word), and the site the
 * bar names — always read from the link, never typed, so a bar can't claim to
 * go somewhere it doesn't.
 */

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^(22[4-9]|2[3-5]\d)\./];

/** The link as it will be saved — https:// added when it was left off — or null when it can't be a button's. */
export function normaliseCtaUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  if (host.startsWith("[")) return null;
  if (PRIVATE_V4.some((range) => range.test(host))) return null;
  if (!host.includes(".")) return null;
  return url.href;
}

/** "example.com" from "https://www.example.com/page": what the bar shows under its headline. */
export function ctaSite(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}
