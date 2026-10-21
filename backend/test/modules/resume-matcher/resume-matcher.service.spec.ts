import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../src/common/types/user.types';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ResumeMatcherService } from '../../../src/resume-matcher/resume-matcher.service';
import { AdzunaJobSource } from '../../../src/resume-matcher/job-sources/adzuna.source';
import { GreenhouseJobSource } from '../../../src/resume-matcher/job-sources/greenhouse.source';
import { JSearchJobSource } from '../../../src/resume-matcher/job-sources/jsearch.source';
import { LeverJobSource } from '../../../src/resume-matcher/job-sources/lever.source';
import { AshbyJobSource } from '../../../src/resume-matcher/job-sources/ashby.source';
import { PlatformJobSource } from '../../../src/resume-matcher/job-sources/platform.source';
import { CandidateJob, JobSourceName } from '../../../src/resume-matcher/job-sources/types';
import { CompanyLogoService } from '../../../src/resume-matcher/company-logos.service';
import { CitiesService } from '../../../src/locations/cities.service';
import { RoleTranslationService } from '../../../src/resume-matcher/role-translation.service';
import { SeekerEntitlementsService } from '../../../src/seeker-entitlements/seeker-entitlements.service';
import { AiService, ParsedResume } from '../../../src/services/ai/ai.service';

describe('ResumeMatcherService', () => {
  const user = { id: 'user-1', displayName: 'Candidate', subscriptionTier: 'premium' } as User;
  const profile = {
    headline: 'Software Engineer', summary: 'Builds services.', currentTitle: 'Engineer',
    city: 'Kampala', skills: ['TypeScript', 'PostgreSQL'], languages: [], experiences: [], educations: [],
  };
  const findProfile = jest.fn();
  const dismissed = { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() };
  const scoreJobMatches = jest.fn();
  const status = jest.fn();
  const isEnforced = jest.fn();
  const tierOf = jest.fn();
  const record = jest.fn();
  const prefetch = jest.fn();
  const logoFor = jest.fn();
  const countryOfText = jest.fn();
  const countryCodeOf = jest.fn();
  const readPlace = jest.fn();
  const currencyOf = jest.fn();
  const localTitle = jest.fn();
  const sources = (['platform', 'adzuna', 'jsearch', 'greenhouse', 'lever', 'ashby'] as const).map((name) => ({
    name, isEnabled: jest.fn(), search: jest.fn(),
  }));
  const service = new ResumeMatcherService(
    { scoreJobMatches } as unknown as AiService,
    { jobSeekerProfile: { findUnique: findProfile }, dismissedMatch: dismissed } as unknown as PrismaService,
    new ConfigService(),
    { status, isEnforced, record, tierOf } as unknown as SeekerEntitlementsService,
    sources[0] as unknown as PlatformJobSource,
    sources[1] as unknown as AdzunaJobSource,
    sources[2] as unknown as JSearchJobSource,
    sources[3] as unknown as GreenhouseJobSource,
    sources[4] as unknown as LeverJobSource,
    sources[5] as unknown as AshbyJobSource,
    { prefetch, logoFor } as unknown as CompanyLogoService,
    { countryOfText, countryCodeOf, readPlace, currencyOf } as unknown as CitiesService,
    { localTitle } as unknown as RoleTranslationService,
  );
  const job = (source: JobSourceName, index = 0): CandidateJob => ({
    id: `${source}:${index}`, title: `${source} Engineer ${index}`, company: 'Acme',
    location: 'Kampala', description: 'TypeScript and PostgreSQL services.', source,
  });
  const candidates = (): CandidateJob[] => scoreJobMatches.mock.calls[0][1];

  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.resetAllMocks();
    findProfile.mockResolvedValue(profile);
    dismissed.findMany.mockResolvedValue([]);
    scoreJobMatches.mockImplementation(async (_profile: ParsedResume, jobs: CandidateJob[]) =>
      jobs.map(({ id }) => ({ id, score: 80, reason: 'Relevant skills.' })),
    );
    isEnforced.mockReturnValue(true);
    status.mockImplementation(async () => ({ allowed: true, reason: null, enforced: isEnforced() }));
    tierOf.mockImplementation((u: { subscriptionTier?: string; role?: string }) =>
      u.subscriptionTier === 'premium' || u.role === 'ADMIN' ? 'premium' : 'free',
    );
    record.mockResolvedValue(undefined);
    prefetch.mockResolvedValue(undefined);
    logoFor.mockReturnValue(undefined);
    for (const source of sources) {
      source.isEnabled.mockReturnValue(true);
      source.search.mockResolvedValue([]);
    }
  });

  it('returns the full empty contract without searching when there is no usable profile', async () => {
    findProfile.mockResolvedValue(null);
    await expect(service.run(user, { query: '  engineer  ' })).resolves.toEqual({
      hasProfile: false, query: 'engineer', matches: [], scope: 'platform', webBlockedReason: null,
      searchedSources: [], unavailableSources: [],
    });
    expect(status).not.toHaveBeenCalled();
    expect(scoreJobMatches).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    for (const source of sources) expect(source.search).not.toHaveBeenCalled();
  });

  it('keeps free platform matching available while enforcement withholds web searches', async () => {
    status.mockResolvedValue({ allowed: false, reason: 'PREMIUM_REQUIRED', enforced: true });
    sources[0].search.mockResolvedValue([job('platform')]);
    const result = await service.run({ ...user, subscriptionTier: 'free' }, {});
    expect(result).toMatchObject({ hasProfile: true, scope: 'platform', webBlockedReason: 'PREMIUM_REQUIRED' });
    expect(result.matches).toHaveLength(1);
    expect(sources[0].search).toHaveBeenCalledWith({ query: 'Engineer', location: 'Kampala', limit: 15 });
    for (const source of sources.slice(1)) expect(source.search).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('includes web sources while enforcement is off even without a web allowance', async () => {
    isEnforced.mockReturnValue(false);
    status.mockResolvedValue({ allowed: false, reason: 'PREMIUM_REQUIRED', enforced: false });
    sources[4].search.mockResolvedValue([job('lever')]);
    const result = await service.run({ ...user, subscriptionTier: 'free' }, { query: 'Developer' });
    expect(result).toMatchObject({ scope: 'web', webBlockedReason: null });
    expect(sources[4].search).toHaveBeenCalledWith({ query: 'Developer', location: '', limit: 15 });
    expect(record).toHaveBeenCalledWith(user.id, 'matcher.web');
  });

  it('shares the 30-job scoring budget across all six sources and returns all of them', async () => {
    for (const source of sources) {
      source.search.mockResolvedValue(Array.from({ length: 15 }, (_, index) => job(source.name, index)));
    }
    const result = await service.run(user, {});
    expect(candidates()).toHaveLength(30);
    expect(candidates().slice(0, 6).map(({ source }) => source)).toEqual(sources.map(({ name }) => name));
    for (const source of sources) {
      expect(candidates().filter((candidate) => candidate.source === source.name)).toHaveLength(5);
    }
    expect(result.matches).toHaveLength(30);
  });

  it('advances past title/company and ID duplicates within a source turn', async () => {
    const shared = { ...job('platform'), title: 'Software   Engineer', company: 'ACME' };
    sources[0].search.mockResolvedValue([shared, job('platform', 1), job('platform', 2)]);
    sources[1].search.mockResolvedValue([
      { ...job('adzuna'), title: 'software engineer', company: 'acme' },
      { ...job('adzuna', 1), id: shared.id },
      job('adzuna', 2), job('adzuna', 2), job('adzuna', 3), job('adzuna', 4),
    ]);
    await service.run(user, {});
    expect(candidates().map(({ id }) => id)).toEqual([
      'platform:0', 'adzuna:2', 'platform:1', 'adzuna:3', 'platform:2', 'adzuna:4',
    ]);
  });

  it('limits a source to its first 15 jobs even if the provider returns more', async () => {
    sources[0].search.mockResolvedValue(Array.from({ length: 40 }, (_, index) => job('platform', index)));
    await service.run(user, {});
    expect(candidates()).toHaveLength(15);
    expect(candidates().at(-1)?.id).toBe('platform:14');
  });

  it('identifies AI scores and preserves their explanation', async () => {
    sources[0].search.mockResolvedValue([job('platform')]);
    const result = await service.run(user, {});
    expect(result.matches[0]).toMatchObject({ matchScore: 80, scoringMode: 'ai', reason: 'Relevant skills.' });
  });

  it('identifies fallback and keeps the existing skill-overlap formula', async () => {
    sources[0].search.mockResolvedValue([job('platform')]);
    scoreJobMatches.mockRejectedValue(new Error('AI unavailable'));
    const result = await service.run(user, {});
    expect(result.matches[0]).toMatchObject({ matchScore: 64, scoringMode: 'heuristic' });
    expect(result.matches[0].reason).toBeUndefined();
  });

  it('records only one web search when multiple external sources return jobs', async () => {
    sources[1].search.mockResolvedValue([job('adzuna')]);
    sources[4].search.mockResolvedValue([job('lever')]);
    await service.run(user, {});
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(user.id, 'matcher.web');
  });

  it.each(['empty', 'failed'] as const)('does not record usage when every web source is %s', async (outcome) => {
    sources[0].search.mockResolvedValue([job('platform')]);
    if (outcome === 'failed') {
      for (const source of sources.slice(1)) source.search.mockRejectedValue(new Error('Source unavailable'));
    }
    const result = await service.run(user, {});
    expect(result.matches).toHaveLength(1);
    expect(result.scope).toBe('web');
    expect(record).not.toHaveBeenCalled();
  });

  it('says which sources were searched and which could not be reached', async () => {
    sources[1].isEnabled.mockReturnValue(false);
    sources[3].search.mockRejectedValue(new Error('every Greenhouse board failed'));
    sources[5].search.mockResolvedValue([job('ashby')]);
    const result = await service.run(user, {});
    expect(result.searchedSources).toEqual(['platform', 'jsearch', 'greenhouse', 'lever', 'ashby']);
    expect(result.unavailableSources).toEqual(['greenhouse']);
    expect(result.matches.map(({ source }) => source)).toEqual(['ashby']);
  });

  it("shows a source's own logo, a looked-up one by website, and none otherwise", async () => {
    sources[0].search.mockResolvedValue([{ ...job('platform'), logoUrl: 'https://cdn.example/own.png' }]);
    sources[5].search.mockResolvedValue([
      { ...job('ashby'), companyDomain: 'jobber.com' },
      { ...job('ashby', 1), companyDomain: 'nologo.com' },
    ]);
    sources[1].search.mockResolvedValue([job('adzuna')]);
    logoFor.mockImplementation((s: { domain?: string }) => (s.domain === 'jobber.com' ? 'https://store.example/jobber.png' : undefined));

    const result = await service.run(user, {});
    const logo = (id: string) => result.matches.find((m) => m.id === id)?.logoUrl;
    // The platform job brings its own logo; the rest are looked up, by name only off-platform.
    expect(prefetch).toHaveBeenCalledWith([
      { domain: undefined, company: 'Acme', byName: true },
      { domain: 'jobber.com', company: 'Acme', byName: true },
      { domain: 'nologo.com', company: 'Acme', byName: true },
    ]);
    expect(logo('platform:0')).toBe('https://cdn.example/own.png');
    expect(logo('ashby:0')).toBe('https://store.example/jobber.png');
    expect(logo('ashby:1')).toBeUndefined();
    expect(logo('adzuna:0')).toBeUndefined();
  });

  it('answers without the logos when they are still loading after scoring', async () => {
    sources[5].search.mockResolvedValue([{ ...job('ashby'), companyDomain: 'slow.com' }]);
    prefetch.mockReturnValue(new Promise(() => undefined));
    const result = await service.run(user, {});
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].logoUrl).toBeUndefined();
  });

  it("says where a web listing was published, and when that is the employer's own site", async () => {
    sources[2].search.mockResolvedValue([
      { ...job('jsearch', 0), publisher: 'LinkedIn' },
      { ...job('jsearch', 1), publisher: 'Acme Careers' },
      { ...job('jsearch', 2), company: 'Bank', publisher: 'TD Bank' },
      job('jsearch', 3),
    ]);
    const result = await service.run(user, {});
    const on = (id: string) => result.matches.find((m) => m.id === id)?.publishedOn;
    expect(on('jsearch:0')).toEqual({ name: 'LinkedIn', isEmployer: false });
    expect(on('jsearch:1')).toEqual({ name: 'Acme Careers', isEmployer: true });
    expect(on('jsearch:2')).toEqual({ name: 'TD Bank', isEmployer: false });
    expect(on('jsearch:3')).toBeUndefined();
  });

  it('leaves out matches the seeker dismissed, by id or by the same job from another source', async () => {
    dismissed.findMany.mockResolvedValue([
      { jobId: 'adzuna:0', title: 'x', company: 'x' },
      { jobId: 'jsearch:old', title: '  ASHBY engineer 0 ', company: 'Acme Inc.' },
    ]);
    sources[1].search.mockResolvedValue([job('adzuna', 0), job('adzuna', 1)]);
    sources[5].search.mockResolvedValue([job('ashby', 0), job('ashby', 1)]);
    const result = await service.run(user, {});
    expect(candidates().map(({ id }) => id).sort()).toEqual(['adzuna:1', 'ashby:1']);
    expect(result.matches.map(({ id }) => id).sort()).toEqual(['adzuna:1', 'ashby:1']);
  });

  it('remembers a dismissal once, and forgets it on undo', async () => {
    await service.dismiss(user, { jobId: 'lever:x:1', title: 'Designer', company: 'Acme' });
    expect(dismissed.upsert).toHaveBeenCalledWith({
      where: { userId_jobId: { userId: 'user-1', jobId: 'lever:x:1' } },
      create: { userId: 'user-1', jobId: 'lever:x:1', title: 'Designer', company: 'Acme' },
      update: {},
    });
    await service.undismiss(user, 'lever:x:1');
    expect(dismissed.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', jobId: 'lever:x:1' } });
  });

  it('passes on when a job was posted, its type, workplace and pay', async () => {
    sources[5].search.mockResolvedValue([{
      ...job('ashby'), postedAt: '2026-10-14T00:00:00.000Z', employmentType: 'full_time', workplace: 'hybrid',
      yearlyPay: { min: 116000, max: 145000, currency: 'CAD' },
    }]);
    const result = await service.run(user, {});
    expect(result.matches[0]).toMatchObject({
      postedAt: '2026-10-14T00:00:00.000Z', employmentType: 'full_time', workplace: 'hybrid',
      yearlyPay: { min: 116000, max: 145000, currency: 'CAD' },
    });
  });

  /** A profile that names its country, and a cities lookup that knows it. */
  const livesIn = (country: string, code: string, city = profile.city) => {
    findProfile.mockResolvedValue({ ...profile, city, country });
    countryCodeOf.mockImplementation((text: string) => (text === country ? code : undefined));
  };

  it("searches a chosen city in its own country, whatever the person's own", async () => {
    livesIn('Uganda', 'UG');
    const result = await service.run(
      user,
      { query: 'Designer', location: ' Vancouver, BC ', countryCode: 'ca' },
      { visitorCountry: 'KE' },
    );
    for (const source of sources) {
      expect(source.search).toHaveBeenCalledWith({ query: 'Designer', location: 'Vancouver, BC', countryCode: 'CA', limit: 15 });
    }
    expect(countryOfText).not.toHaveBeenCalled();
    expect(result).toMatchObject({ location: 'Vancouver, BC', countryCode: 'CA', homeCountryCode: 'UG' });
  });

  it('leaves out jobs clearly in another country, and keeps those that do not say', async () => {
    countryOfText.mockImplementation((text: string) => (text === 'Toronto' ? 'CA' : text === 'Kampala' ? 'UG' : undefined));
    sources[5].search.mockResolvedValue([
      { ...job('ashby', 0), location: 'Toronto' },
      { ...job('ashby', 1), location: 'Kampala' },
      { ...job('ashby', 2), location: 'Remote' },
    ]);
    await service.run(user, { location: 'Kampala, Uganda', countryCode: 'UG' });
    expect(candidates().map(({ id }) => id).sort()).toEqual(['ashby:1', 'ashby:2']);
    expect(countryOfText).toHaveBeenCalledWith('Toronto', 'UG');
  });

  it('trusts the country a source states for a job over its location text', async () => {
    sources[2].search.mockResolvedValue([
      { ...job('jsearch', 0), location: 'GH', countryCode: 'GH' },
      { ...job('jsearch', 1), location: 'UG', countryCode: 'UG' },
    ]);
    await service.run(user, { location: '', countryCode: 'UG' });
    expect(candidates().map(({ id }) => id)).toEqual(['jsearch:1']);
  });

  it("searches anywhere in the person's country when the location box is emptied", async () => {
    livesIn('Uganda', 'UG');
    const result = await service.run(user, { location: '' });
    expect(sources[0].search).toHaveBeenCalledWith({ query: 'Engineer', location: '', countryCode: 'UG', limit: 15 });
    expect(result).toMatchObject({ location: '', countryCode: 'UG', homeCountryCode: 'UG' });
  });

  it("reads the profile's city as the person's: London for a Canadian is London, ON", async () => {
    livesIn('Canada', 'CA', 'London');
    countryOfText.mockImplementation((text: string, near?: string) => (text === 'London' ? (near === 'CA' ? 'CA' : 'GB') : undefined));
    await service.run(user, {});
    expect(sources[0].search).toHaveBeenCalledWith({ query: 'Engineer', location: 'London', countryCode: 'CA', limit: 15 });
  });

  it("searches the city typed in its own country, even outside the person's", async () => {
    livesIn('Uganda', 'UG');
    countryOfText.mockImplementation((text: string) => (text === 'Nairobi' ? 'KE' : undefined));
    const result = await service.run(user, { location: 'Nairobi' });
    expect(countryOfText).toHaveBeenCalledWith('Nairobi', 'UG');
    expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ location: 'Nairobi', countryCode: 'KE' }));
    expect(result).toMatchObject({ countryCode: 'KE', homeCountryCode: 'UG' });
  });

  it("searches the person's country when the place typed can't be placed", async () => {
    livesIn('Uganda', 'UG');
    await service.run(user, { location: 'Somewhere Unknown' });
    expect(sources[1].search).toHaveBeenCalledWith(expect.objectContaining({ location: 'Somewhere Unknown', countryCode: 'UG' }));
  });

  it("knows the person's country from the profile's city when the profile names none", async () => {
    countryOfText.mockImplementation((text: string) => (text === 'Kampala' ? 'UG' : undefined));
    const result = await service.run(user, { location: '' });
    expect(sources[0].search).toHaveBeenCalledWith(expect.objectContaining({ location: '', countryCode: 'UG' }));
    expect(result).toMatchObject({ homeCountryCode: 'UG' });
  });

  it("falls back to the visitor's country, then to each source's own default", async () => {
    findProfile.mockResolvedValue({ ...profile, city: '' });
    const fromKenya = await service.run(user, {}, { visitorCountry: 'ke' });
    expect(sources[0].search).toHaveBeenLastCalledWith(expect.objectContaining({ location: '', countryCode: 'KE' }));
    expect(fromKenya).toMatchObject({ homeCountryCode: 'KE' });

    const unknown = await service.run(user, {});
    expect(sources[0].search).toHaveBeenLastCalledWith(expect.objectContaining({ location: '', countryCode: undefined }));
    expect(unknown).toMatchObject({ homeCountryCode: undefined });
  });

  describe('a province or a country where a city would be', () => {
    it('searches a whole province, written plainly, and shows it so', async () => {
      findProfile.mockResolvedValue({ ...profile, city: 'ONTARIO CANADA' });
      readPlace.mockReturnValue({ kind: 'region', region: 'Ontario', countryCode: 'CA', country: 'Canada' });
      const result = await service.run(user, {});
      expect(sources[2].search).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'Ontario, Canada', countryCode: 'CA', region: undefined }),
      );
      expect(result).toMatchObject({ location: 'Ontario, Canada', countryCode: 'CA' });
    });

    it("reads Quebec's ads in French when the province is searched whole", async () => {
      readPlace.mockReturnValue({ kind: 'region', region: 'Quebec', countryCode: 'CA', country: 'Canada' });
      await service.run(user, { query: 'Nurse', location: 'Quebec, Canada' });
      expect(localTitle).toHaveBeenCalledWith('Nurse', 'fr');
    });

    it('searches anywhere in a country written on its own', async () => {
      findProfile.mockResolvedValue({ ...profile, city: 'UGANDA' });
      readPlace.mockReturnValue({ kind: 'country', countryCode: 'UG', country: 'Uganda' });
      const result = await service.run(user, {});
      expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ location: '', countryCode: 'UG' }));
      expect(result).toMatchObject({ location: '', countryCode: 'UG' });
    });

    it('lets a country picked from suggestions outrank a reading that disagrees', async () => {
      readPlace.mockReturnValue({ kind: 'region', region: 'Ontario', countryCode: 'CA', country: 'Canada' });
      await service.run(user, { location: 'Ontario', countryCode: 'US' });
      expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ location: 'Ontario', countryCode: 'US' }));
    });
  });

  describe('scoring against the résumé', () => {
    const fullAd = `${'Founded in 2019, Acme builds trusted software. '.repeat(20)}\nRequirements\n5+ years of React and TypeScript.`;

    it('shows the AI what each job asks for, not its opening blurb', async () => {
      sources[2].search.mockResolvedValue([{ ...job('jsearch'), description: fullAd }]);
      await service.run(user, {});
      expect(candidates()[0].description).toBe('Requirements 5+ years of React and TypeScript.');
    });

    it('keeps a job known only by its snippet below a confirmed fit', async () => {
      sources[1].search.mockResolvedValue([{ ...job('adzuna'), description: 'Senior Frontend Engineer at Acme. React…' }]);
      sources[2].search.mockResolvedValue([{ ...job('jsearch'), description: fullAd }]);
      scoreJobMatches.mockImplementation(async (_p: ParsedResume, jobs: CandidateJob[]) =>
        jobs.map(({ id }) => ({ id, score: id.startsWith('adzuna') ? 92 : 88, reason: 'Fits.' })),
      );
      const result = await service.run(user, {});
      expect(result.matches.map((m) => [m.id, m.matchScore])).toEqual([['jsearch:0', 88], ['adzuna:0', 80]]);
    });
  });

  describe('job ads in the local language', () => {
    it('searches the local title as well, with the region and currency, and says so', async () => {
      localTitle.mockResolvedValue('Pflegefachkraft');
      currencyOf.mockImplementation((code: string) => (code === 'DE' ? 'EUR' : undefined));
      readPlace.mockReturnValue({ kind: 'city', city: { name: 'Munich', region: 'Bavaria', countryCode: 'DE' } });
      const result = await service.run(user, { query: 'Nurse', location: 'Munich', countryCode: 'DE' });

      expect(localTitle).toHaveBeenCalledWith('Nurse', 'de');
      expect(sources[1].search).toHaveBeenCalledWith({
        query: 'Nurse', localQuery: 'Pflegefachkraft', location: 'Munich', region: 'Bavaria', countryCode: 'DE', currency: 'EUR', limit: 15,
      });
      expect(result).toMatchObject({ localQuery: 'Pflegefachkraft', localLanguage: 'German' });
    });

    it("reads Montreal's ads in French, and Toronto's in English", async () => {
      readPlace.mockReturnValue({ kind: 'city', city: { name: 'Montréal', region: 'Quebec', countryCode: 'CA' } });
      await service.run(user, { query: 'Nurse', location: 'Montreal, QC', countryCode: 'CA' });
      expect(localTitle).toHaveBeenCalledWith('Nurse', 'fr');

      localTitle.mockClear();
      readPlace.mockReturnValue({ kind: 'city', city: { name: 'Toronto', region: 'Ontario', countryCode: 'CA' } });
      const result = await service.run(user, { query: 'Nurse', location: 'Toronto, ON', countryCode: 'CA' });
      expect(localTitle).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('localQuery');
    });

    it("ignores a region from a city in another country than the one searched", async () => {
      readPlace.mockReturnValue({ kind: 'city', city: { name: 'Paris', region: 'Texas', countryCode: 'US' } });
      await service.run(user, { query: 'Nurse', location: 'Paris', countryCode: 'FR' });
      expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ region: undefined, countryCode: 'FR' }));
    });

    it('searches in English rather than wait long for a first translation', async () => {
      jest.useFakeTimers();
      try {
        localTitle.mockReturnValue(new Promise(() => undefined));
        const run = service.run(user, { query: 'Nurse', location: '', countryCode: 'DE' });
        await jest.advanceTimersByTimeAsync(4000);
        const result = await run;
        expect(sources[1].search).toHaveBeenCalledWith(expect.objectContaining({ query: 'Nurse', localQuery: undefined }));
        expect(result).not.toHaveProperty('localQuery');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('searching the web for a job alert', () => {
    const person = { id: 'user-1', role: 'JOB_SEEKER', subscriptionTier: 'premium' } as const;
    const free = { ...person, subscriptionTier: 'free' } as const;

    it('asks the web sources only, waits for slow ones, and skips any it is told to', async () => {
      sources[2].search.mockResolvedValue([job('jsearch')]);
      sources[1].search.mockResolvedValue([job('adzuna')]);
      const found = await service.findWebJobs(person, { query: 'Nurse', location: ' Kampala ' }, { without: ['lever'] });

      expect(sources[0].search).not.toHaveBeenCalled(); // platform: the alert's own check covers it
      expect(sources[4].search).not.toHaveBeenCalled(); // lever, left out as asked
      expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ query: 'Nurse', location: 'Kampala', waitMs: 45_000 }));
      expect(found?.searched).toEqual(['adzuna', 'jsearch', 'greenhouse', 'ashby']);
      expect(found?.jobs.map((j) => j.id).sort()).toEqual(['adzuna:0', 'jsearch:0']);
      expect(scoreJobMatches).not.toHaveBeenCalled();
    });

    it("searches the person's own country, and leaves out what they dismissed", async () => {
      findProfile.mockResolvedValue({ city: '', country: 'Uganda' });
      countryCodeOf.mockImplementation((text: string) => (text === 'Uganda' ? 'UG' : undefined));
      dismissed.findMany.mockResolvedValue([{ jobId: 'jsearch:0', title: 'x', company: 'y' }]);
      sources[2].search.mockResolvedValue([job('jsearch', 0), job('jsearch', 1)]);
      const found = await service.findWebJobs(person, { query: 'Nurse', location: '' });
      expect(sources[2].search).toHaveBeenCalledWith(expect.objectContaining({ location: '', countryCode: 'UG' }));
      expect(found?.jobs.map((j) => j.id)).toEqual(['jsearch:1']);
    });

    it("finds nothing when the person's plan has no web, once that is enforced", async () => {
      await expect(service.findWebJobs(free, { query: 'Nurse', location: '' })).resolves.toBeNull();
      expect(sources[2].search).not.toHaveBeenCalled();
      expect(isEnforced).toHaveBeenCalledWith('matcher.web');

      isEnforced.mockReturnValue(false);
      await expect(service.findWebJobs(free, { query: 'Nurse', location: '' })).resolves.not.toBeNull();
    });

    it("still checks for a Premium member who used up the day's searches", async () => {
      status.mockResolvedValue({ allowed: false, reason: 'ALLOWANCE_EXHAUSTED', enforced: true });
      await expect(service.findWebJobs(person, { query: 'Nurse', location: '' })).resolves.not.toBeNull();
    });
  });

  it('reports every source unreachable when all of them fail', async () => {
    for (const source of sources) source.search.mockRejectedValue(new Error('down'));
    const result = await service.run(user, {});
    expect(result.matches).toEqual([]);
    expect(result.searchedSources).toHaveLength(6);
    expect(result.unavailableSources).toEqual(result.searchedSources);
  });
});
