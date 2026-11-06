import type { PrismaService } from '../prisma/prisma.service';

/**
 * A company page's own address, /company/<slug>, with LinkedIn's rules for
 * linkedin.com/company/<name>:
 *
 * - lowercase letters, digits and hyphens; anything else typed becomes a
 *   hyphen rather than an error (LinkedIn: "Any improper characters are
 *   automatically replaced with a hyphen");
 * - no doubled hyphens, none at either end;
 * - at least one letter, so an address is never mistaken for an id;
 * - unique — "if linkedin.com/company/abc is already in use, you can try
 *   linkedin.com/company/abcinc".
 *
 * The migration that gave existing pages their slugs applies the same rules
 * (20261104150000_company_page_slug).
 */

export const SLUG_MAX = 100;

/** Words kept for the app's own use under /company/. */
const RESERVED = new Set(['new', 'setup', 'admin', 'edit', 'settings']);

/** The address as typed, put into shape. Empty when nothing usable remains. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

/** Why an already-normalized address can't be used, or null when it can. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 2) return 'Use at least two letters or numbers.';
  if (!/[a-z]/.test(slug)) return 'Include at least one letter.';
  if (RESERVED.has(slug)) return 'That address is reserved. Try another.';
  return null;
}

/** Whether a well-formed address is free, ignoring the page it already belongs to. */
async function isFree(db: Pick<PrismaService, 'employerProfile'>, slug: string, pageId?: string | null) {
  const holder = await db.employerProfile.findUnique({ where: { slug }, select: { id: true } });
  return !holder || holder.id === pageId;
}

export interface SlugCheck {
  /** The address as it would be saved. */
  slug: string;
  available: boolean;
  /** What to fix, when not available. */
  reason: string | null;
}

/** What the page-address field reports while someone types. */
export async function checkSlug(
  db: Pick<PrismaService, 'employerProfile'>,
  input: string,
  pageId?: string | null,
): Promise<SlugCheck> {
  const slug = normalizeSlug(input);
  const problem = slugProblem(slug);
  if (problem) return { slug, available: false, reason: problem };
  if (!(await isFree(db, slug, pageId))) {
    return { slug, available: false, reason: `That address is taken. Try ${slug}-inc or add your city.` };
  }
  return { slug, available: true, reason: null };
}

/**
 * A free address made from a company name, for a page created without one
 * typed in: the name itself, then -2, -3 and so on. Null when the name has
 * no usable letters; the page is then reached by its id until someone picks
 * an address.
 */
export async function slugFromName(
  db: Pick<PrismaService, 'employerProfile'>,
  name: string,
  pageId?: string | null,
): Promise<string | null> {
  const base = normalizeSlug(name).slice(0, SLUG_MAX - 4).replace(/-+$/g, '');
  if (slugProblem(base)) return null;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (await isFree(db, candidate, pageId)) return candidate;
  }
  return null;
}

/** True for a string shaped like a profile id rather than an address. */
export function looksLikeId(ref: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
}
