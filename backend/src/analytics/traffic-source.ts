/**
 * Traffic-source classification.
 *
 * Deliberately a small, readable rule set rather than a big vendor list: a
 * channel breakdown is only useful if you can say exactly why a visit landed in
 * a bucket, and anything unrecognised goes to "Referral" rather than being
 * guessed into a nicer-looking category.
 */
export type Channel = 'Direct' | 'Search' | 'Social' | 'Paid' | 'Referral' | 'Email';

const SEARCH_HOSTS = [
  'google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'baidu.', 'yandex.', 'brave.',
];

const SOCIAL_HOSTS = [
  'linkedin.', 'facebook.', 'instagram.', 'x.com', 'twitter.', 't.co', 'reddit.',
  'tiktok.', 'youtube.', 'threads.', 'bsky.', 'mastodon.', 'pinterest.', 'whatsapp.',
  'telegram.', 'discord.',
];

const EMAIL_HOSTS = ['mail.google.', 'outlook.', 'mail.yahoo.', 'mail.proton.'];

/** utm_medium values that mean someone paid for the click. */
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid-search', 'display', 'cpm', 'retargeting'];
const EMAIL_MEDIUMS = ['email', 'newsletter'];
const SOCIAL_MEDIUMS = ['social', 'social-organic', 'sm'];

export interface SourceInput {
  /** Referrer host, already reduced from the full URL. */
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
}

/**
 * Which channel a visit belongs to.
 *
 * UTM medium wins over the referrer, because that's the distinction the
 * referrer can't make: a paid LinkedIn ad and an organic LinkedIn post both
 * arrive with a linkedin.com referrer.
 */
export function classify(input: SourceInput): Channel {
  const medium = (input.utmMedium ?? '').toLowerCase().trim();
  if (PAID_MEDIUMS.includes(medium)) return 'Paid';
  if (EMAIL_MEDIUMS.includes(medium)) return 'Email';
  if (SOCIAL_MEDIUMS.includes(medium)) return 'Social';

  const host = (input.source ?? '').toLowerCase().trim();

  // No referrer and no campaign tag: typed the address, used a bookmark, or
  // the referrer was stripped (very common from apps and https→http).
  if (!host) return 'Direct';

  if (EMAIL_HOSTS.some((h) => host.startsWith(h))) return 'Email';
  if (SEARCH_HOSTS.some((h) => host.startsWith(h))) return 'Search';
  if (SOCIAL_HOSTS.some((h) => host.startsWith(h) || host === h.replace(/\.$/, ''))) return 'Social';

  return 'Referral';
}

/**
 * Note shown with any channel breakdown.
 *
 * "Direct" is the honest bucket for several different things, and reading it as
 * "people who typed our name" overstates brand strength — worth saying once,
 * where the number is displayed.
 */
export const CHANNEL_CAVEAT =
  'Direct covers visits with no referrer: typed addresses, bookmarks, and links from apps or documents that strip it.';
