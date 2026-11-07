import { ConfigService } from '@nestjs/config';
import { AdzunaJobSource } from '../../../src/resume-matcher/job-sources/adzuna.source';
import { JSearchJobSource } from '../../../src/resume-matcher/job-sources/jsearch.source';
import { PlatformJobSource } from '../../../src/resume-matcher/job-sources/platform.source';
import { CandidateJob, rankByTerms } from '../../../src/resume-matcher/job-sources/types';
import { PrismaService } from '../../../src/prisma/prisma.service';

const json = (body: unknown) => new Response(JSON.stringify(body));
afterEach(() => jest.restoreAllMocks());

describe('Adzuna and the chosen country', () => {
  const adzuna = () => new AdzunaJobSource(new ConfigService({ ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key', ADZUNA_COUNTRY: 'ca' }));

  it("searches the city's country, in its currency", async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(
      json({ results: [{ id: '1', title: 'Engineer', salary_min: 120000, salary_max: 150000, created: '2026-10-01T00:00:00Z' }] }),
    );
    const [job] = await adzuna().search({ query: 'engineer', location: 'Austin, TX', countryCode: 'US', limit: 15 });
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toContain('/jobs/us/search/1?');
    expect(url).toContain('where=Austin%2C+TX');
    expect(job.salary).toBe('US$120k–US$150k');
    expect(job.yearlyPay).toEqual({ min: 120000, max: 150000, currency: 'USD' });
  });

  it('offers nothing for a country it does not cover, without asking', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    await expect(adzuna().search({ query: 'engineer', location: 'Kampala, Uganda', countryCode: 'UG', limit: 15 })).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('searches in the local language as well, local ads first, each job once', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const what = new URL(String(url)).searchParams.get('what');
      return what === 'Pflegefachkraft'
        ? json({ results: [{ id: 'de1', title: 'Pflegefachkraft' }, { id: 'both', title: 'Pflegefachkraft / Nurse' }] })
        : json({ results: [{ id: 'en1', title: 'Study Nurse' }, { id: 'both', title: 'Pflegefachkraft / Nurse' }] });
    });
    const jobs = await adzuna().search({ query: 'nurse', localQuery: 'Pflegefachkraft', location: 'Berlin', countryCode: 'DE', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jobs.map((j) => j.id)).toEqual(['adzuna:de1', 'adzuna:en1', 'adzuna:both']);
  });

  it('keeps what one language found when the other search fails, and fails only when both do', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) =>
      new URL(String(url)).searchParams.get('what') === 'nurse'
        ? json({ results: [{ id: 'en1', title: 'Study Nurse' }] })
        : new Response('{}', { status: 500 }),
    );
    const input = { query: 'nurse', localQuery: 'Pflegefachkraft', location: '', countryCode: 'DE', limit: 15 };
    await expect(adzuna().search(input)).resolves.toHaveLength(1);

    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('{}', { status: 500 }));
    await expect(adzuna().search(input)).rejects.toThrow('HTTP 500');
  });

  it('uses its configured country when no country is known', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(json({ results: [] }));
    await adzuna().search({ query: 'engineer', location: '', limit: 15 });
    expect(String(fetch.mock.calls[0][0])).toContain('/jobs/ca/search/1?');
  });
});

describe('JSearch and the chosen country', () => {
  it("asks Google for Jobs in the city's country", async () => {
    // A fresh answer each time: a city this empty is searched country-wide too.
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async () => json({ data: { jobs: [] } }));
    await new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' })).search({
      query: 'nurse', location: 'Kampala, Uganda', countryCode: 'UG', limit: 15,
    });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get('country')).toBe('ug');
    expect(url.searchParams.get('query')).toBe('nurse in Kampala, Uganda');
  });

  it('asks for the local title and the role in one request, quoting two-word titles', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async () => json({ data: { jobs: [] } }));
    const jsearch = new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' }));
    await jsearch.search({ query: 'nurse', localQuery: 'Pflegefachkraft', location: '', countryCode: 'DE', limit: 15 });
    await jsearch.search({ query: 'software engineer', localQuery: 'ingénieur logiciel', location: 'Paris', countryCode: 'FR', limit: 15 });
    const asked = fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('query'));
    expect(asked[0]).toBe('Pflegefachkraft OR nurse in Germany');
    expect(asked[1]).toBe('"ingénieur logiciel" OR "software engineer" in Paris');
  });

  it('asks once, as before, when the local title is the role itself', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async () => json({ data: { jobs: [] } }));
    await new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' })).search({
      query: 'Accountant', localQuery: 'accountant', location: '', countryCode: 'NL', limit: 15,
    });
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('query')).toBe('Accountant in Netherlands');
  });

  it("states pay in the country's currency when the listing gives none, and hourly pay as hourly", async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => json({ data: { jobs: [
      { job_id: 'a', job_title: 'Nurse', job_min_salary: 25, job_max_salary: 30, job_salary_period: 'HOUR' },
      { job_id: 'b', job_title: 'Nurse', job_min_salary: 50000, job_max_salary: 60000, job_salary_period: 'YEAR', job_salary_currency: 'EUR' },
    ] } }));
    const jobs = await new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' })).search({
      query: 'nurse', location: '', countryCode: 'US', currency: 'USD', limit: 15,
    });
    expect(jobs.map((j) => j.salary)).toEqual(['US$25–US$30/hr', '€50k–€60k']);
    expect(jobs[0].yearlyPay).toEqual({ min: 52000, max: 62400, currency: 'USD' });
  });

  it('keeps the country Google gives a job, which may be all its location says', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => json({ data: { jobs: [
      { job_id: 'a', job_title: 'School Nurse', employer_name: 'Acme', job_country: 'GH' },
      { job_id: 'b', job_title: 'Nurse', employer_name: 'Acme', job_city: 'Kampala', job_country: 'ug' },
      { job_id: 'c', job_title: 'Nurse', employer_name: 'Beta' },
    ] } }));
    const jobs = await new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' })).search({
      query: 'nurse', location: '', countryCode: 'UG', limit: 15,
    });
    expect(jobs.map((j) => [j.location, j.countryCode])).toEqual([['GH', 'GH'], ['Kampala, ug', 'UG'], ['', undefined]]);
  });
});

describe("Coral's own jobs and the chosen city", () => {
  it('matches the city, not the whole label', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await new PlatformJobSource({ job: { findMany } } as unknown as PrismaService).search({
      query: 'engineer', location: 'Toronto, ON', countryCode: 'CA', limit: 15,
    });
    expect(JSON.stringify(findMany.mock.calls[0][0].where)).toContain('{"location":{"contains":"Toronto","mode":"insensitive"}}');
  });
});

describe('employer boards and the chosen city', () => {
  const job = (id: string, title: string, location: string): CandidateJob => ({
    id, title, company: 'Acme', location, description: '', source: 'ashby',
  });

  it('prefers jobs in the city without dropping the rest', () => {
    const ranked = rankByTerms(
      [
        job('toronto', 'Frontend Engineer', 'Toronto'),
        job('vancouver', 'Frontend Engineer', 'Vancouver, BC'),
        job('remote', 'Frontend Engineer', 'Remote (Canada)'),
        job('chef', 'Chef', 'Vancouver, BC'),
      ],
      ['frontend', 'engineer'],
      'Vancouver',
    );
    expect(ranked.map((j) => j.id)).toEqual(['vancouver', 'toronto', 'remote']);
  });
});
