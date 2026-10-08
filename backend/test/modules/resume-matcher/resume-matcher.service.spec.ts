import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../src/common/types/user.types';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ResumeMatcherService } from '../../../src/resume-matcher/resume-matcher.service';
import { AdzunaJobSource } from '../../../src/resume-matcher/job-sources/adzuna.source';
import { GreenhouseJobSource } from '../../../src/resume-matcher/job-sources/greenhouse.source';
import { JSearchJobSource } from '../../../src/resume-matcher/job-sources/jsearch.source';
import { LeverJobSource } from '../../../src/resume-matcher/job-sources/lever.source';
import { PlatformJobSource } from '../../../src/resume-matcher/job-sources/platform.source';
import { CandidateJob, JobSourceName } from '../../../src/resume-matcher/job-sources/types';
import { SeekerEntitlementsService } from '../../../src/seeker-entitlements/seeker-entitlements.service';
import { AiService, ParsedResume } from '../../../src/services/ai/ai.service';

describe('ResumeMatcherService', () => {
  const user = { id: 'user-1', displayName: 'Candidate', subscriptionTier: 'premium' } as User;
  const profile = {
    headline: 'Software Engineer', summary: 'Builds services.', currentTitle: 'Engineer',
    city: 'Kampala', skills: ['TypeScript', 'PostgreSQL'], languages: [], experiences: [], educations: [],
  };
  const findProfile = jest.fn();
  const scoreJobMatches = jest.fn();
  const status = jest.fn();
  const isEnforced = jest.fn();
  const record = jest.fn();
  const sources = (['platform', 'adzuna', 'jsearch', 'greenhouse', 'lever'] as const).map((name) => ({
    name, isEnabled: jest.fn(), search: jest.fn(),
  }));
  const service = new ResumeMatcherService(
    { scoreJobMatches } as unknown as AiService,
    { jobSeekerProfile: { findUnique: findProfile } } as unknown as PrismaService,
    new ConfigService(),
    { status, isEnforced, record } as unknown as SeekerEntitlementsService,
    sources[0] as unknown as PlatformJobSource,
    sources[1] as unknown as AdzunaJobSource,
    sources[2] as unknown as JSearchJobSource,
    sources[3] as unknown as GreenhouseJobSource,
    sources[4] as unknown as LeverJobSource,
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
    scoreJobMatches.mockImplementation(async (_profile: ParsedResume, jobs: CandidateJob[]) =>
      jobs.map(({ id }) => ({ id, score: 80, reason: 'Relevant skills.' })),
    );
    status.mockResolvedValue({ allowed: true, reason: null });
    isEnforced.mockReturnValue(true);
    record.mockResolvedValue(undefined);
    for (const source of sources) {
      source.isEnabled.mockReturnValue(true);
      source.search.mockResolvedValue([]);
    }
  });

  it('returns the full empty contract without searching when there is no usable profile', async () => {
    findProfile.mockResolvedValue(null);
    await expect(service.run(user, { query: '  engineer  ' })).resolves.toEqual({
      hasProfile: false, query: 'engineer', matches: [], scope: 'platform', webBlockedReason: null,
    });
    expect(status).not.toHaveBeenCalled();
    expect(scoreJobMatches).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    for (const source of sources) expect(source.search).not.toHaveBeenCalled();
  });

  it('keeps free platform matching available while enforcement withholds web searches', async () => {
    status.mockResolvedValue({ allowed: false, reason: 'PREMIUM_REQUIRED' });
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
    status.mockResolvedValue({ allowed: false, reason: 'PREMIUM_REQUIRED' });
    sources[4].search.mockResolvedValue([job('lever')]);
    const result = await service.run({ ...user, subscriptionTier: 'free' }, { query: 'Developer' });
    expect(result).toMatchObject({ scope: 'web', webBlockedReason: null });
    expect(sources[4].search).toHaveBeenCalledWith({ query: 'Developer', location: '', limit: 15 });
    expect(record).toHaveBeenCalledWith(user.id, 'matcher.web');
  });

  it('shares the 30-job scoring budget across all five sources and ranks the top 20', async () => {
    for (const source of sources) {
      source.search.mockResolvedValue(Array.from({ length: 15 }, (_, index) => job(source.name, index)));
    }
    const result = await service.run(user, {});
    expect(candidates()).toHaveLength(30);
    expect(candidates().slice(0, 5).map(({ source }) => source)).toEqual(sources.map(({ name }) => name));
    for (const source of sources) {
      expect(candidates().filter((candidate) => candidate.source === source.name)).toHaveLength(6);
    }
    expect(result.matches).toHaveLength(20);
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
});
