const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
]);

/** True for consumer mail hosts, which say nothing about where someone works. */
export function isFreeEmailDomain(domain?: string | null): boolean {
  return !!domain && FREE_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/**
 * Extracts a lowercase, www-stripped domain from an email address or URL.
 * Returns null if the value is empty or unparseable.
 */
export function extractDomain(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const domain = trimmed.split('@').pop();
    return domain || null;
  }

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export type VerificationStatus = 'unverified' | 'verified';

/** Stored verification levels, weakest first. */
const LEVELS = ['unverified', 'domain_verified', 'verified'] as const;
export type VerificationLevel = (typeof LEVELS)[number];

const rank = (v: string) => Math.max(LEVELS.indexOf(v as VerificationLevel), 0);

/**
 * The level an employer holds after re-checking their website domain.
 *
 * Verification stopped being a pure function of the website once documents
 * could be reviewed by a person. Two rules follow, and both matter:
 *
 * - **A level is never lowered here.** Recomputing destructively meant an
 *   employer whose document had been approved lost their verification the
 *   moment they edited their website — silently revoking a human decision
 *   from an unrelated form.
 * - **A domain match earns `domain_verified`, never `verified`.** The visible
 *   badge is the one that says a person checked; granting it from a matching
 *   hostname would route around review entirely.
 */
export function raiseVerificationLevel(
  current: string | null | undefined,
  domainMatch: VerificationStatus,
): VerificationLevel {
  const held = (current ?? 'unverified') as VerificationLevel;
  const earned: VerificationLevel = domainMatch === 'verified' ? 'domain_verified' : 'unverified';
  return rank(earned) > rank(held) ? earned : held;
}

/**
 * Derives a coarse trust signal by comparing the employer's account email
 * domain against the company website they declared. Subdomains of the
 * declared website (e.g. mail.acme.com for acme.com) also count as a match.
 * Free webmail domains never qualify, even on a match.
 */
export function computeVerificationStatus(
  email: string,
  companyWebsite?: string | null,
): VerificationStatus {
  const emailDomain = extractDomain(email);
  const websiteDomain = extractDomain(companyWebsite);

  if (!emailDomain || !websiteDomain) return 'unverified';
  if (FREE_EMAIL_DOMAINS.has(emailDomain)) return 'unverified';

  if (emailDomain === websiteDomain || emailDomain.endsWith(`.${websiteDomain}`)) {
    return 'verified';
  }

  return 'unverified';
}
