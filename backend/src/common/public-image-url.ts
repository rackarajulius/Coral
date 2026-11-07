/**
 * An image address fit to send with a list of things: a web URL, or null.
 *
 * Older company logos were saved inline as `data:` URIs, often hundreds of
 * kilobytes each, which would otherwise ride along in every post of a feed
 * (scripts/move-inline-company-images.ts puts them in storage). Anything
 * that isn't http(s) is not an image address at all.
 */
export function publicImageUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}
