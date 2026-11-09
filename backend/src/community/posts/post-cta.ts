import { BadRequestException } from '@nestjs/common';
import { PostCtaLabel } from '@prisma/client';
import { isPrivateHost } from '../link-preview.service';

/**
 * A call-to-action bar under a post, as on LinkedIn's sponsored posts: a
 * headline, a link, and a button from a fixed list.
 *
 * The site the bar shows is read from the link when it is drawn, never typed
 * by the author, so a bar cannot say it goes somewhere it does not. Only the
 * reader's browser ever opens the link — the server never fetches it — so
 * the check is on the address alone: a public web address, nothing on a
 * private network, and nothing dressed up as another site.
 */

export interface PostCtaInput {
  label: PostCtaLabel;
  url: string;
  headline: string;
}

/** Most of a headline LinkedIn shows before cutting it; the rest is allowed, up to 200. */
export const CTA_HEADLINE_MAX = 200;

/**
 * The address a button may open, or null.
 *
 * - **http or https** only: no `javascript:`, `data:` or file links.
 * - **No name or password in it**: `https://bank.com@evil.example` goes to
 *   evil.example, and reads as the bank.
 * - **A public site**: a real domain, never localhost, an internal name or an
 *   address on a private network, which would point a reader at their own
 *   router or office intranet.
 *
 * A link typed without a scheme is taken as https.
 */
export function publicWebAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname;
  if (isPrivateHost(host)) return null;
  // A name with a dot in it (example.com), or a public IP address.
  if (!host.includes('.') && !host.includes(':')) return null;
  return url.href.length <= 2000 ? url.href : null;
}

/** The columns a post stores for its bar, checked; nothing when it has none. */
export function ctaColumns(
  cta: PostCtaInput | undefined,
): { ctaLabel: PostCtaLabel; ctaUrl: string; ctaHeadline: string } | Record<string, never> {
  if (!cta) return {};
  if (!Object.values(PostCtaLabel).includes(cta.label)) throw new BadRequestException('Pick a button from the list.');
  const headline = cta.headline.replace(/\s+/g, ' ').trim();
  if (!headline) throw new BadRequestException('Give the button a headline.');
  if (headline.length > CTA_HEADLINE_MAX) throw new BadRequestException(`Keep the headline to ${CTA_HEADLINE_MAX} characters.`);
  const url = publicWebAddress(cta.url);
  if (!url) throw new BadRequestException("The button's link must be a public web address, like https://example.com.");
  return { ctaLabel: cta.label, ctaUrl: url, ctaHeadline: headline };
}
