import { resolvePageRef } from '../../../src/company/company-page';
import { checkSlug, looksLikeId, normalizeSlug, slugFromName, slugProblem } from '../../../src/company/page-slug';

function collaborator<T>(value: unknown): T { return value as T; }

/** Addresses already held, by page id. */
function store(held: Record<string, string>) {
  return {
    employerProfile: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.slug) {
          const id = Object.keys(held).find((pageId) => held[pageId] === where.slug);
          return id ? { id } : null;
        }
        // canonicalPageId reading a page: these are all pages.
        return where.id ? { id: where.id, companyId: 'company', pageOf: { id: 'company' } } : null;
      }),
    },
    company: { findUnique: jest.fn() },
  };
}

describe('A company page address', () => {
  it("is put into LinkedIn's shape rather than refused for its characters", () => {
    expect(normalizeSlug('Airtel Uganda')).toBe('airtel-uganda');
    expect(normalizeSlug('  MTN  UGANDA!! ')).toBe('mtn-uganda');
    expect(normalizeSlug('--Acme--Ltd--')).toBe('acme-ltd');
    expect(normalizeSlug('Coral & Co.')).toBe('coral-co');
    expect(normalizeSlug('x'.repeat(150))).toHaveLength(100);
  });

  it('needs two characters, a letter, and not one of the words kept for the app', () => {
    expect(slugProblem('a')).toMatch('at least two');
    expect(slugProblem('2024')).toMatch('one letter');
    expect(slugProblem('admin')).toMatch('reserved');
    expect(slugProblem('acme')).toBeNull();
  });

  it("is refused when another page holds it, and is fine for the page that already does", async () => {
    const db = collaborator<never>(store({ 'page-acme': 'acme' }));
    await expect(checkSlug(db, 'ACME')).resolves.toEqual({
      slug: 'acme', available: false, reason: 'That address is taken. Try acme-inc or add your city.',
    });
    await expect(checkSlug(db, 'acme', 'page-acme')).resolves.toMatchObject({ slug: 'acme', available: true });
    await expect(checkSlug(db, 'Acme Kampala')).resolves.toEqual({ slug: 'acme-kampala', available: true, reason: null });
    await expect(checkSlug(db, '!!')).resolves.toMatchObject({ available: false, reason: expect.stringMatching('at least two') });
  });

  it('is made from the name when none is typed: the name, then -2, -3', async () => {
    await expect(slugFromName(collaborator(store({})), 'Acme')).resolves.toBe('acme');
    await expect(slugFromName(collaborator(store({ a: 'acme' })), 'Acme')).resolves.toBe('acme-2');
    await expect(slugFromName(collaborator(store({ a: 'acme', b: 'acme-2' })), 'Acme')).resolves.toBe('acme-3');
    // A name with no letters gets none; the page is reached by its id.
    await expect(slugFromName(collaborator(store({})), '2024')).resolves.toBeNull();
  });

  it('or a profile id finds the page, and anything else finds nothing', async () => {
    const db = collaborator<never>(store({ 'page-airtel': 'airtel-uganda' }));
    expect(looksLikeId('55e90318-aad9-47fd-828b-0faea1d89392')).toBe(true);
    expect(looksLikeId('airtel-uganda')).toBe(false);
    await expect(resolvePageRef(db, 'airtel-uganda')).resolves.toBe('page-airtel');
    await expect(resolvePageRef(db, 'Airtel-Uganda')).resolves.toBe('page-airtel');
    await expect(resolvePageRef(db, '55e90318-aad9-47fd-828b-0faea1d89392')).resolves.toBe('55e90318-aad9-47fd-828b-0faea1d89392');
    await expect(resolvePageRef(db, 'nobody-here')).resolves.toBeNull();
  });
});
