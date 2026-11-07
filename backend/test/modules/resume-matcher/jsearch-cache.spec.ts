import { ConfigService } from '@nestjs/config';
import { JSearchJobSource } from '../../../src/resume-matcher/job-sources/jsearch.source';
import { ResultCache } from '../../../src/resume-matcher/job-sources/types';

const listing = (id: string) => ({ job_id: id, job_title: `Engineer ${id}`, employer_name: 'Acme', job_city: 'Toronto' });

/** A /search-v2 answer: the jobs sit under data.jobs. Ids are j0, j1… (or k0, k1… for prefix "k"). */
const page = (n: number, prefix = 'j') => ({
  data: { jobs: Array.from({ length: n }, (_, i) => listing(`${prefix}${i}`)) },
});

/** The search text a request asked JSearch for: "Nurse in Kampala". */
const queryOf = (url: string) => new URL(url).searchParams.get('query');

function harness(answer: (url: string) => Response | Promise<Response> = () => new Response(JSON.stringify(page(10)))) {
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (url) => answer(String(url)));
  const jsearch = new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'rapid-key', JSEARCH_COUNTRY: 'ca' }));
  return { fetch, jsearch };
}

afterEach(() => jest.restoreAllMocks());

describe('JSearch results cache', () => {
  it('reuses one request for the same role and city, however it is typed', async () => {
    const { fetch, jsearch } = harness();
    const first = await jsearch.search({ query: 'Software Engineer', location: 'Toronto', limit: 15 });
    const again = await jsearch.search({ query: '  software   ENGINEER ', location: 'toronto ', limit: 3 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(10);
    expect(again.map((j) => j.id)).toEqual(['jsearch:j0', 'jsearch:j1', 'jsearch:j2']);
  });

  it('asks again for a different city or role', async () => {
    const { fetch, jsearch } = harness();
    await jsearch.search({ query: 'Software Engineer', location: 'Toronto', limit: 15 });
    await jsearch.search({ query: 'Software Engineer', location: 'Vancouver', limit: 15 });
    await jsearch.search({ query: 'Designer', location: 'Toronto', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('shares one request between searches that arrive together', async () => {
    const { fetch, jsearch } = harness();
    await Promise.all([
      jsearch.search({ query: 'Analyst', location: '', limit: 15 }),
      jsearch.search({ query: 'analyst', location: '', limit: 15 }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failure, so the next search tries again', async () => {
    let calls = 0;
    const { fetch, jsearch } = harness(() =>
      ++calls === 1
        ? new Response(JSON.stringify({ message: 'You are not subscribed to this API.' }), { status: 403 })
        : new Response(JSON.stringify(page(6))),
    );
    await expect(jsearch.search({ query: 'Nurse', location: 'Calgary', limit: 15 })).rejects.toThrow('HTTP 403');
    await expect(jsearch.search({ query: 'Nurse', location: 'Calgary', limit: 15 })).resolves.toHaveLength(6);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks again once the hour is up', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { fetch, jsearch } = harness();
    await jsearch.search({ query: 'Chef', location: 'Ottawa', limit: 15 });
    now.mockReturnValue(1_000_000 + 59 * 60_000);
    await jsearch.search({ query: 'Chef', location: 'Ottawa', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_000_000 + 61 * 60_000);
    await jsearch.search({ query: 'Chef', location: 'Ottawa', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('calls /search-v2 with the RapidAPI key', async () => {
    const { fetch, jsearch } = harness();
    await jsearch.search({ query: 'Welder', location: 'Regina', limit: 15 });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/jsearch\.p\.rapidapi\.com\/search-v2\?/);
    expect(init?.headers).toMatchObject({ 'X-RapidAPI-Key': 'rapid-key', 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' });
  });

  it('keeps a slow answer for the next search instead of abandoning a paid request', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(
      () => new Promise((done) => setTimeout(() => done(new Response(JSON.stringify(page(6)))), 80)),
    );
    const jsearch = new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'rapid-key', JSEARCH_WAIT_MS: '20' }));
    const input = { query: 'Slow Role', location: 'Halifax', limit: 15 };

    await expect(jsearch.search(input)).rejects.toThrow('still answering');
    await new Promise((r) => setTimeout(r, 120));
    await expect(jsearch.search(input)).resolves.toHaveLength(6);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('makes no request without a key', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    const jsearch = new JSearchJobSource(new ConfigService({}));
    await expect(jsearch.search({ query: 'Chef', location: '', limit: 15 })).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('JSearch beyond a thin city', () => {
  const kampala = { query: 'Nurse', location: 'Kampala', countryCode: 'UG', limit: 15 };

  it("searches the whole country too when a city has few jobs, the city's first", async () => {
    const { fetch, jsearch } = harness((url) =>
      new Response(JSON.stringify(
        queryOf(url) === 'Nurse in Kampala'
          ? page(3, 'k')
          : { data: { jobs: [listing('k1'), { ...listing('k2'), job_id: 'k2-relisted' }, ...page(8).data.jobs] } },
      )),
    );
    const found = await jsearch.search(kampala);

    expect(fetch).toHaveBeenCalledTimes(2);
    const wide = new URL(String(fetch.mock.calls[1][0])).searchParams;
    expect([wide.get('query'), wide.get('country')]).toEqual(['Nurse in Uganda', 'ug']);
    // The city's three, then the country's eight. k1 came back again, and k2
    // under a new id; each is shown once.
    expect(found.map((j) => j.id)).toEqual([
      'jsearch:k0', 'jsearch:k1', 'jsearch:k2',
      ...Array.from({ length: 8 }, (_, i) => `jsearch:j${i}`),
    ]);
  });

  it('asks once when the city has enough', async () => {
    const { fetch, jsearch } = harness(() => new Response(JSON.stringify(page(5))));
    await expect(jsearch.search(kampala)).resolves.toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('names the country when searching anywhere in it, and asks once however few', async () => {
    const { fetch, jsearch } = harness(() => new Response(JSON.stringify(page(2))));
    await jsearch.search({ ...kampala, location: '' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queryOf(String(fetch.mock.calls[0][0]))).toBe('Nurse in Uganda');
  });

  it("keeps the city's jobs when the country search fails, and tries it again next time", async () => {
    const { fetch, jsearch } = harness((url) =>
      queryOf(url) === 'Nurse in Kampala'
        ? new Response(JSON.stringify(page(3, 'k')))
        : new Response('{}', { status: 500 }),
    );
    await expect(jsearch.search(kampala)).resolves.toHaveLength(3);
    await expect(jsearch.search(kampala)).resolves.toHaveLength(3);
    // The city once (cached), the failed country search twice (never cached).
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  describe('in a big country', () => {
    const moosejaw = { query: 'Nurse', location: 'Moose Jaw, SK', region: 'Saskatchewan', countryCode: 'CA', limit: 15 };

    it('widens to the province first, and stops there when it has enough', async () => {
      const { fetch, jsearch } = harness((url) =>
        new Response(JSON.stringify(queryOf(url) === 'Nurse in Moose Jaw, SK' ? page(2, 'k') : page(8))),
      );
      await expect(jsearch.search(moosejaw)).resolves.toHaveLength(10);
      expect(fetch.mock.calls.map(([url]) => queryOf(String(url)))).toEqual([
        'Nurse in Moose Jaw, SK',
        'Nurse in Saskatchewan, Canada',
      ]);
    });

    it('goes on to the whole country when the province is thin too', async () => {
      const { fetch, jsearch } = harness((url) => {
        const q = queryOf(url);
        return new Response(JSON.stringify(q === 'Nurse in Moose Jaw, SK' ? page(1, 'k') : q === 'Nurse in Saskatchewan, Canada' ? page(2, 'p') : page(8)));
      });
      await expect(jsearch.search(moosejaw)).resolves.toHaveLength(11);
      expect(fetch.mock.calls.map(([url]) => queryOf(String(url)))[2]).toBe('Nurse in Canada');
    });

    it('goes straight to the country in a small one', async () => {
      const { fetch, jsearch } = harness((url) => new Response(JSON.stringify(queryOf(url) === 'Nurse in Kampala' ? page(3, 'k') : page(8))));
      await jsearch.search({ ...kampala, region: 'Central Region' });
      expect(fetch.mock.calls.map(([url]) => queryOf(String(url)))).toEqual(['Nurse in Kampala', 'Nurse in Uganda']);
    });
  });

  it("shows the city's jobs while the whole country is still being searched", async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (url) =>
      queryOf(String(url)) === 'Nurse in Kampala'
        ? new Response(JSON.stringify(page(3, 'k')))
        : new Promise<Response>((done) => setTimeout(() => done(new Response(JSON.stringify(page(8)))), 80)),
    );
    const jsearch = new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'rapid-key', JSEARCH_WAIT_MS: '20' }));

    await expect(jsearch.search(kampala)).resolves.toHaveLength(3);
    await new Promise((r) => setTimeout(r, 120));
    await expect(jsearch.search(kampala)).resolves.toHaveLength(11);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('ResultCache', () => {
  it('drops the oldest search once full', async () => {
    const cache = new ResultCache<string>(60_000, 2);
    const load = jest.fn(async () => 'x');
    await cache.get('a', load);
    await cache.get('b', load);
    await cache.get('c', load); // evicts "a"
    await cache.get('b', load);
    await cache.get('a', load);
    expect(load).toHaveBeenCalledTimes(4);
  });
});
