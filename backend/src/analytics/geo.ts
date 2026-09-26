import type { Request } from 'express';

/**
 * Coarse visitor location.
 *
 * Two sources, deliberately kept apart because their accuracy differs by a lot:
 *
 * - **CDN header** (Cloudflare `cf-ipcountry`, Vercel, CloudFront, Fly). The
 *   edge already resolved the IP, so this is accurate and free. Only present
 *   when deployed behind one of them.
 * - **Browser timezone**. Always available, but only good for a continent-level
 *   region: many zones span several countries, and anyone on a VPN or with a
 *   travelling laptop reports where their clock is, not where they are.
 *
 * A third option — a GeoIP database or a lookup API — is deliberately not used:
 * it means either a ~70MB data file with a licence, or a paid call on the hot
 * path. That's a purchasing decision, not something to slip in.
 *
 * No IP is ever stored. It's read from the header, used, and dropped.
 */

/** Headers the common edges set, in the order we trust them. */
const COUNTRY_HEADERS = [
  'cf-ipcountry', // Cloudflare
  'x-vercel-ip-country', // Vercel
  'cloudfront-viewer-country', // AWS CloudFront
  'x-country-code', // Fly.io / generic proxies
  'x-appengine-country', // Google App Engine
];

/**
 * "Asia Pacific" used to cover India, Japan, China, Singapore and Australia in
 * one bucket. On a hiring platform that's the least useful grouping there is —
 * whichever market dominates hides all the others inside it — so the region is
 * split into the four that behave like separate talent markets.
 */
export type Region =
  | 'North America'
  | 'Latin America'
  | 'Europe'
  | 'Africa'
  | 'Middle East'
  | 'South Asia'
  | 'East Asia'
  | 'Southeast Asia'
  | 'Oceania'
  | 'Unknown';

/** ISO-2 country from the edge, or null when not deployed behind one. */
export function countryFromRequest(req: Request): string | null {
  for (const h of COUNTRY_HEADERS) {
    const raw = req.headers[h];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();
    // Cloudflare sends "XX" for anonymised/unknown, and "T1" for Tor.
    if (value && /^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1') {
      return value;
    }
  }
  return null;
}

/** IANA zones in the Americas that aren't North America. */
const LATAM_ZONES = [
  'america/argentina', 'america/sao_paulo', 'america/bogota', 'america/lima',
  'america/santiago', 'america/caracas', 'america/montevideo', 'america/la_paz',
  'america/asuncion', 'america/guayaquil', 'america/mexico_city', 'america/monterrey',
  'america/guatemala', 'america/panama', 'america/costa_rica', 'america/havana',
  'america/santo_domingo', 'america/san_salvador', 'america/tegucigalpa',
  'america/managua', 'america/port-au-prince', 'america/recife', 'america/fortaleza',
  'america/manaus', 'america/belem', 'america/cuiaba', 'america/bahia',
];

const MIDDLE_EAST_ZONES = [
  'asia/dubai', 'asia/riyadh', 'asia/qatar', 'asia/kuwait', 'asia/bahrain',
  'asia/muscat', 'asia/tehran', 'asia/baghdad', 'asia/jerusalem', 'asia/tel_aviv',
  'asia/amman', 'asia/beirut', 'asia/damascus', 'asia/gaza', 'asia/hebron',
  'asia/aden',
];

/**
 * `Asia/` zones that belong to Europe. Without these, Cyprus would fall through
 * to the catch-all `asia/` rule and report as East Asia; Turkey's canonical
 * zone is already `Europe/Istanbul`, and the deprecated `Asia/Istanbul` alias
 * should match it rather than being split off.
 */
const EUROPEAN_ASIA_ZONES = ['asia/nicosia', 'asia/famagusta', 'asia/istanbul'];

const SOUTH_ASIA_ZONES = [
  'asia/kolkata', 'asia/calcutta', 'asia/karachi', 'asia/dhaka', 'asia/colombo',
  'asia/kathmandu', 'asia/thimphu', 'indian/maldives', 'asia/kabul',
];

const EAST_ASIA_ZONES = [
  'asia/tokyo', 'asia/seoul', 'asia/shanghai', 'asia/chongqing', 'asia/harbin',
  'asia/hong_kong', 'asia/macau', 'asia/taipei', 'asia/pyongyang', 'asia/ulaanbaatar',
];

const SOUTHEAST_ASIA_ZONES = [
  'asia/singapore', 'asia/jakarta', 'asia/makassar', 'asia/jayapura', 'asia/pontianak',
  'asia/manila', 'asia/bangkok', 'asia/ho_chi_minh', 'asia/saigon', 'asia/hanoi',
  'asia/kuala_lumpur', 'asia/kuching', 'asia/phnom_penh', 'asia/vientiane',
  'asia/yangon', 'asia/rangoon', 'asia/brunei', 'asia/dili',
];

/**
 * `Atlantic/` is not one region. Most of it is Europe (Azores, Canary,
 * Reykjavik, Faroe, Madeira), but Bermuda is North America and Cape Verde and
 * St Helena are Africa — all three previously reported as Europe.
 */
const ATLANTIC_EXCEPTIONS: Record<string, Region> = {
  'atlantic/bermuda': 'North America',
  'atlantic/cape_verde': 'Africa',
  'atlantic/st_helena': 'Africa',
};

/**
 * Continent-level region from an IANA timezone.
 *
 * Approximate by design. It answers "roughly where is my audience" and should
 * never be presented as a country-level breakdown.
 */
export function regionFromTimezone(timezone?: string | null): Region {
  const tz = (timezone ?? '').trim().toLowerCase();
  if (!tz) return 'Unknown';

  // Exact-match lists first — they carve specific zones out of the broad
  // prefixes below, so order matters.
  if (EUROPEAN_ASIA_ZONES.includes(tz)) return 'Europe';
  if (MIDDLE_EAST_ZONES.includes(tz)) return 'Middle East';
  if (SOUTH_ASIA_ZONES.includes(tz)) return 'South Asia';
  if (EAST_ASIA_ZONES.includes(tz)) return 'East Asia';
  if (SOUTHEAST_ASIA_ZONES.includes(tz)) return 'Southeast Asia';
  if (ATLANTIC_EXCEPTIONS[tz]) return ATLANTIC_EXCEPTIONS[tz];
  if (LATAM_ZONES.some((z) => tz.startsWith(z))) return 'Latin America';

  if (tz.startsWith('america/')) return 'North America';
  if (tz.startsWith('europe/') || tz.startsWith('atlantic/')) return 'Europe';
  if (tz.startsWith('africa/') || tz.startsWith('indian/')) return 'Africa';
  if (tz.startsWith('australia/') || tz.startsWith('pacific/')) return 'Oceania';
  // Any remaining Asia/* zone — Central Asia and the Russian Far East mostly.
  // Grouped with East Asia rather than invented into a region of their own.
  if (tz.startsWith('asia/')) return 'East Asia';
  return 'Unknown';
}

/** Bounded, validated IANA zone — this arrives from a browser. */
export function sanitizeTimezone(value?: string | null): string | null {
  const tz = (value ?? '').trim().slice(0, 64);
  return /^[A-Za-z_+-]+\/[A-Za-z_0-9+-]+(\/[A-Za-z_0-9+-]+)?$/.test(tz) ? tz : null;
}

export const GEO_CAVEATS = {
  country:
    'Country comes from your visitors’ network location, resolved at the edge.',
  timezone:
    'Approximate: derived from each visitor’s device timezone, not their network location. A VPN or a travelling laptop reports where the clock is set.',
};
