import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyLogoService, LogoSubject } from '../../../src/resume-matcher/company-logos.service';
import { normalizeName, sameCompany } from '../../../src/resume-matcher/job-sources/types';
import { COMPANY_BUCKET, StorageService } from '../../../src/storage/storage.service';

/** A PNG header with the given size, which is all the service reads. */
function png(size: number): Uint8Array<ArrayBuffer> {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(size, 16);
  b.writeUInt32BE(size, 20);
  return new Uint8Array(b);
}

/** A JPEG start-of-image and frame header with the given size. */
function jpeg(width: number, height: number): Uint8Array<ArrayBuffer> {
  const b = Buffer.alloc(24);
  Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]).copy(b, 0);
  b.writeUInt16BE(height, 7);
  b.writeUInt16BE(width, 9);
  return new Uint8Array(b);
}

const STORE ='https://store.example/company-assets/';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const site = (domain: string): LogoSubject => ({ domain, company: domain, byName: false });
const named = (company: string): LogoSubject => ({ company, byName: true });

type Route = (url: string, method: string) => Response | Promise<Response> | undefined;

/**
 * A fake network. Nothing is stored unless a test says so, Google has a sharp
 * icon for every site, and Logo.dev is configured only when a key is given.
 */
function harness({ key, routes = [] }: { key?: string; routes?: Route[] } = {}) {
  const storage = {
    publicUrlFor: jest.fn((path: string) => `${STORE}${path}`),
    uploadPublicFile: jest.fn(async (path: string) => `${STORE}${path}`),
  };
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    for (const route of routes) {
      const answer = await route(url, method);
      if (answer) return answer;
    }
    if (method === 'HEAD' && url.startsWith(STORE)) return new Response(null, { status: 400 });
    if (url.includes('google.com/s2/favicons')) return new Response(png(128), { status: 200 });
    throw new Error(`unexpected request ${method} ${url}`);
  });
  const service = new CompanyLogoService(
    storage as unknown as StorageService,
    new ConfigService(key ? { LOGO_DEV_SECRET_KEY: key } : {}),
  );
  const calls = (fragment: string) => fetch.mock.calls.filter(([u]) => String(u).includes(fragment)).length;
  const logo = async (subject: LogoSubject) => {
    await service.prefetch([subject]);
    return service.logoFor(subject);
  };
  return { service, storage, fetch, calls, logo };
}

beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('company names', () => {
  it.each([
    ['OpenTable Inc.', 'OpenTable', 'opentable.com', true],
    ['Forma.ai', 'Forma', 'forma.ai', true],
    ['Rush Street Interactive', 'Rush Street Interactive', 'rushstreetinteractive.com', true],
    ['Questrade Financial Group', 'Questrade', 'questrade.com', false],
    ['OSI Maritime Systems', 'OSI Systems', 'osi-systems.com', false],
    ['Company', 'Company', 'company.com', false],
  ])('%s is %s / %s: %s', (company, name, domain, expected) => {
    expect(sameCompany(company, name, domain)).toBe(expected);
  });

  it('sets aside legal forms, accents and punctuation', () => {
    expect(normalizeName('Café & Co., Ltd.')).toBe('cafe and');
    expect(normalizeName('Confidential')).toBe('');
  });
});

describe('logos from Google site icons (no Logo.dev key)', () => {
  it('uses the stored copy without asking Google', async () => {
    const { logo, calls } = harness({ routes: [(u, m) => (m === 'HEAD' ? new Response(null, { status: 200 }) : undefined)] });
    expect(await logo(site('stored.com'))).toBe(`${STORE}job-board-logos/stored.com.png`);
    expect(calls('google.com')).toBe(0);
  });

  it('copies a sharp icon into storage once, then serves it from the cache', async () => {
    const { service, storage, logo, calls } = harness();
    await service.prefetch([site('jobber.com'), site('jobber.com')]);
    expect(await logo(site('jobber.com'))).toBe(`${STORE}job-board-logos/jobber.com.png`);
    expect(storage.uploadPublicFile).toHaveBeenCalledWith(
      'job-board-logos/jobber.com.png', expect.any(Buffer), 'image/png', COMPANY_BUCKET,
    );
    expect(calls('google.com')).toBe(1);
  });

  it.each([
    ['a site Google has no icon for (404 with a globe)', () => new Response(png(16), { status: 404 })],
    ['an icon too small for the card', () => new Response(png(16), { status: 200 })],
    ['something that is not a PNG', () => new Response('<html></html>', { status: 200 })],
  ])('gives no logo for %s, and remembers that', async (_label, google) => {
    const { logo, storage, calls } = harness({ routes: [(u) => (u.includes('google.com') ? google() : undefined)] });
    expect(await logo(site('geotab.com'))).toBeUndefined();
    await logo(site('geotab.com'));
    expect(storage.uploadPublicFile).not.toHaveBeenCalled();
    expect(calls('google.com')).toBe(1);
  });

  it('tries again after a network failure instead of remembering it', async () => {
    const { logo, calls } = harness({
      routes: [(u) => { if (u.includes('google.com')) throw new Error('socket hang up'); return undefined; }],
    });
    expect(await logo(site('flaky.com'))).toBeUndefined();
    await logo(site('flaky.com'));
    expect(calls('google.com')).toBe(2);
  });

  it('ignores anything that is not a plain domain', async () => {
    const { service, calls } = harness();
    await service.prefetch([site(''), site('localhost'), site('x.com/../../etc')]);
    expect(calls('google.com')).toBe(0);
  });

  it('gives no logo, rather than linking Google, when storage is not configured', async () => {
    const { logo, storage, calls } = harness();
    storage.publicUrlFor.mockReturnValue(null as unknown as string);
    expect(await logo(site('jobber.com'))).toBeUndefined();
    expect(calls('google.com')).toBe(0);
  });

  it('does not look companies up by name without Logo.dev', async () => {
    const { logo, calls } = harness();
    expect(await logo(named('OpenTable'))).toBeUndefined();
    expect(calls('logo.dev')).toBe(0);
  });
});

describe("logo images published with a listing (JSearch's)", () => {
  const GSTATIC = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ABC';
  const listing = (extra: Partial<LogoSubject> = {}): LogoSubject => ({
    company: 'Stikeman Elliott LLP', imageUrl: GSTATIC, byName: true, ...extra,
  });
  const image = (body: Uint8Array<ArrayBuffer>, status = 200): Route => (u) =>
    u.startsWith('https://encrypted-tbn0.gstatic.com/') ? new Response(body, { status }) : undefined;

  it('copies the image into storage, keeping its type', async () => {
    const { logo, storage } = harness({ routes: [image(jpeg(56, 56))] });
    const url = await logo(listing());
    expect(url).toMatch(new RegExp(`^${STORE}job-board-logos/images/[0-9a-f]{32}$`));
    expect(storage.uploadPublicFile).toHaveBeenCalledWith(
      expect.stringMatching(/^job-board-logos\/images\//), expect.any(Buffer), 'image/jpeg', COMPANY_BUCKET,
    );
  });

  it('prefers a trusted website over the listing image', async () => {
    const { logo, calls } = harness({ routes: [image(jpeg(56, 56))] });
    expect(await logo(listing({ domain: 'tangerine.net' }))).toBe(`${STORE}job-board-logos/tangerine.net.png`);
    expect(calls('gstatic.com')).toBe(0);
  });

  it('prefers the listing image over a name search', async () => {
    const { logo, calls } = harness({ key: 'sk_test', routes: [image(jpeg(56, 56))] });
    expect(await logo(listing())).toMatch(/job-board-logos\/images\//);
    expect(calls('/v2/search')).toBe(0);
  });

  it.each([
    ['too small to read', () => image(jpeg(16, 16))],
    ['not an image', () => image(new Uint8Array(Buffer.from('<html>nope</html>')))],
  ])('keeps the letter when the image is %s', async (_label, route) => {
    const { logo, storage } = harness({ routes: [route()] });
    expect(await logo(listing({ byName: false }))).toBeUndefined();
    expect(storage.uploadPublicFile).not.toHaveBeenCalled();
  });

  it.each([
    'https://evilgstatic.com/logo.png',
    'http://encrypted-tbn0.gstatic.com/images?q=x',
    'https://169.254.169.254/latest/meta-data',
  ])('never fetches an image from %s', async (imageUrl) => {
    const { logo, fetch } = harness();
    expect(await logo(listing({ imageUrl, byName: false }))).toBeUndefined();
    expect(fetch.mock.calls.some(([u]) => String(u).startsWith(imageUrl))).toBe(false);
  });
});

describe('logos from Logo.dev', () => {
  const search = (results: Array<{ name: string; domain: string }>): Route => (u) =>
    u.includes('api.logo.dev/v2/search') ? json({ data: results }) : undefined;
  const brandLogo = (status = 200): Route => (u) =>
    u.includes('api.logo.dev/v2/brands/logo')
      ? status === 200
        ? json({ data: { url: 'https://img.logo.dev/assets/SEALED', etag: 'e1' } })
        : json({ error: 'x' }, status)
      : undefined;
  const download: Route = (u) => (u.startsWith('https://img.logo.dev/assets/') ? new Response(png(128)) : undefined);

  it('finds a named company, and keeps the API logo as a 128px PNG', async () => {
    const { logo, storage, fetch, calls } = harness({
      key: 'sk_test',
      routes: [search([{ name: 'OpenTable', domain: 'opentable.com' }]), brandLogo(), download],
    });
    expect(await logo(named('OpenTable Inc.'))).toBe(`${STORE}job-board-logos/logo-dev/opentable.com.png`);
    expect(storage.uploadPublicFile).toHaveBeenCalledWith(
      'job-board-logos/logo-dev/opentable.com.png', expect.any(Buffer), 'image/png', COMPANY_BUCKET,
    );
    const auth = fetch.mock.calls.find(([u]) => String(u).includes('/v2/search'))?.[1]?.headers;
    expect(auth).toEqual({ Authorization: 'Bearer sk_test' });
    const fileUrl = String(fetch.mock.calls.find(([u]) => String(u).includes('img.logo.dev/assets'))?.[0]);
    expect(fileUrl).toContain('size=128');
    expect(fileUrl).toContain('format=png');
    expect(calls('google.com')).toBe(0);
  });

  it('shows no logo when the closest candidate is a different company', async () => {
    const { logo, calls } = harness({
      key: 'sk_test',
      routes: [search([{ name: 'OSI Systems', domain: 'osi-systems.com' }]), brandLogo(), download],
    });
    expect(await logo(named('OSI Maritime Systems'))).toBeUndefined();
    expect(calls('/v2/brands/logo')).toBe(0);
  });

  it('accepts one brand under several country domains, taking the first', async () => {
    const { logo } = harness({
      key: 'sk_test',
      routes: [
        search([
          { name: 'OpenTable', domain: 'opentable.com' },
          { name: 'OpenTable', domain: 'opentable.fr' },
          { name: 'OpenTable', domain: 'opentable.ie' },
        ]),
        brandLogo(),
        download,
      ],
    });
    expect(await logo(named('OpenTable'))).toBe(`${STORE}job-board-logos/logo-dev/opentable.com.png`);
  });

  it.each([
    ['different companies share the name', 'Venn', [
      { name: 'Venn', domain: 'venn.ca' }, { name: 'Venn', domain: 'venn.city' }, { name: 'VENN', domain: 'thevenn.com' },
    ]],
    ['a same-name company has another site', 'Faire', [
      { name: 'Faire', domain: 'faire.com' }, { name: 'Faire', domain: 'ctfaire.com' },
    ]],
    ['the top record is not the one people mean', 'Cerebras', [
      { name: 'cerebras', domain: 'cerebras.com' }, { name: 'Cerebras Systems', domain: 'cerebras.ai' },
    ]],
  ])('keeps the letter when %s (%s)', async (_label, company, results) => {
    const { logo, calls } = harness({ key: 'sk_test', routes: [search(results), brandLogo(), download] });
    expect(await logo(named(company))).toBeUndefined();
    expect(calls('/v2/brands/logo')).toBe(0);
  });

  it('shows the stored site icon while the Logo.dev logo is fetched, then switches', async () => {
    // Logo.dev's answer is held back until the card has been given the icon.
    let releaseLogo!: () => void;
    const logoReady = new Promise<void>((done) => (releaseLogo = done));
    const { service, logo } = harness({
      key: 'sk_test',
      routes: [
        (u, m) => (m === 'HEAD' && u === `${STORE}job-board-logos/jobber.com.png` ? new Response(null, { status: 200 }) : undefined),
        (u) => (u.includes('/v2/brands/logo') ? logoReady.then(() => json({ data: { url: 'https://img.logo.dev/assets/SEALED' } })) : undefined),
        download,
      ],
    });

    expect(await logo(site('jobber.com'))).toBe(`${STORE}job-board-logos/jobber.com.png`);
    releaseLogo();
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(service.logoFor(site('jobber.com'))).toBe(`${STORE}job-board-logos/logo-dev/jobber.com.png`);
  });

  it('never searches by name for one of our own employers', async () => {
    const { logo, calls } = harness({ key: 'sk_test', routes: [search([{ name: 'Acme', domain: 'acme.com' }])] });
    expect(await logo({ company: 'Acme', byName: false })).toBeUndefined();
    expect(calls('logo.dev')).toBe(0);
  });

  it("falls back to Google's icon when Logo.dev has no logo", async () => {
    const { logo, calls } = harness({ key: 'sk_test', routes: [brandLogo(404)] });
    expect(await logo(site('clutch.ca'))).toBe(`${STORE}job-board-logos/clutch.ca.png`);
    expect(calls('google.com')).toBe(1);
  });

  it('stops asking Logo.dev once its credits are used up, and keeps showing Google icons', async () => {
    const { service, logo, calls } = harness({ key: 'sk_test', routes: [brandLogo(402)] });
    expect(await logo(site('one.com'))).toBe(`${STORE}job-board-logos/one.com.png`);
    await service.prefetch([site('two.com')]);
    expect(calls('/v2/brands/logo')).toBe(1);
    expect(service.logoFor(site('two.com'))).toBe(`${STORE}job-board-logos/two.com.png`);
  });

  it('asks again later while Logo.dev is still preparing the brand', async () => {
    const { logo, calls } = harness({ key: 'sk_test', routes: [brandLogo(202)] });
    expect(await logo(site('new.com'))).toBeUndefined();
    await logo(site('new.com'));
    expect(calls('/v2/brands/logo')).toBe(2);
  });
});
