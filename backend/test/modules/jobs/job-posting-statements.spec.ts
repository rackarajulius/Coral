import { BadRequestException } from '@nestjs/common';
import { User } from '../../../src/common/types/user.types';
import { JobsService } from '../../../src/jobs/jobs.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AiScreenService } from '../../../src/employer-hiring/ai-screen.service';
import { JobFeedService } from '../../../src/distribution/job-feed.service';
import { ConfigService } from '@nestjs/config';

const employer = { id: 'emp-1', role: 'EMPLOYER' } as User;

describe('a job posting and its statements', () => {
  const prisma = {
    job: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    aiScreen: { count: jest.fn() },
    savedJob: { count: jest.fn() },
    application: { groupBy: jest.fn(), findMany: jest.fn() },
  };
  const jobs = new JobsService(
    prisma as unknown as PrismaService,
    {} as never,
    { memberUserIds: jest.fn().mockResolvedValue(['emp-1']) } as never,
    { recomputeForJob: jest.fn().mockResolvedValue(undefined) } as never,
    { recordFor: jest.fn().mockResolvedValue(undefined) } as never,
  );
  const existing = { id: 'job-1', postedById: 'emp-1', title: 'Nurse', status: 'draft', salaryMin: null, salaryMax: null, publishedAt: null, usesAi: true };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.job.findUnique.mockResolvedValue(existing);
    prisma.job.create.mockImplementation(async ({ data }) => ({ id: 'job-1', ...data }));
    prisma.job.update.mockImplementation(async ({ data }) => ({ ...existing, ...data }));
  });

  it('saves what the posting states, and leaves the vacancy unstated when not chosen', async () => {
    await jobs.createJob(employer, { title: 'Nurse', description: 'Care.', employmentType: 'full-time', existingVacancy: false, usesAi: true });
    expect(prisma.job.create.mock.calls[0][0].data).toMatchObject({ existingVacancy: false, usesAi: true });

    await jobs.createJob(employer, { title: 'Cook', description: 'Cook.', employmentType: 'full-time' });
    expect(prisma.job.create.mock.calls[1][0].data).toMatchObject({ existingVacancy: null, usesAi: false });
  });

  it('can set the vacancy back to unstated', async () => {
    await jobs.updateJob('job-1', employer, { existingVacancy: null });
    expect(prisma.job.update.mock.calls[0][0].data).toMatchObject({ existingVacancy: null });
  });

  it("keeps saying AI is used once Coral's AI has screened the job's applicants", async () => {
    prisma.aiScreen.count.mockResolvedValue(3);
    await expect(jobs.updateJob('job-1', employer, { usesAi: false })).rejects.toThrow(BadRequestException);
    expect(prisma.job.update).not.toHaveBeenCalled();

    // Only rounds the AI scores count: written and live, not video.
    expect(prisma.aiScreen.count).toHaveBeenCalledWith({ where: { jobId: 'job-1', mode: { in: ['text', 'live'] } } });

    prisma.aiScreen.count.mockResolvedValue(0);
    await jobs.updateJob('job-1', employer, { usesAi: false });
    expect(prisma.job.update.mock.calls[0][0].data).toMatchObject({ usesAi: false });
  });

  it('tells the edit form when the AI statement is locked on', async () => {
    prisma.job.findUnique.mockResolvedValue({ ...existing, viewsCount: 0, applicationsCount: 0 });
    prisma.savedJob.count.mockResolvedValue(0);
    prisma.application.groupBy.mockResolvedValue([]);
    prisma.application.findMany.mockResolvedValue([]);
    prisma.aiScreen.count.mockResolvedValue(1);
    const snapshot = await jobs.getJobManagementSnapshot('job-1', employer);
    expect(snapshot.job).toMatchObject({ aiScreened: true });
  });
});

describe('screening applicants with AI', () => {
  const prisma = {
    job: { findUnique: jest.fn(), update: jest.fn() },
    application: { findMany: jest.fn() },
    aiScreen: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    employerProfile: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const screens = new AiScreenService(
    prisma as unknown as PrismaService,
    {} as never,
    { create: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const job = (usesAi: boolean) => ({
    id: 'job-1', title: 'Nurse', description: 'Care.', requirements: [], skills: [], experienceLevel: null,
    postedById: 'emp-1', usesAi, screeningQuestions: ['Why nursing?'], screeningGeneratedAt: null, screeningLanguage: null,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.application.findMany.mockResolvedValue([{ id: 'app-1', applicantId: 'cand-1' }]);
    prisma.aiScreen.findMany.mockResolvedValue([]);
    prisma.aiScreen.count.mockResolvedValue(0);
    prisma.aiScreen.create.mockImplementation(async ({ data }) => ({ id: 'screen-1', status: 'invited', createdAt: new Date(), ...data }));
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    prisma.employerProfile.findUnique.mockResolvedValue({ companyName: 'Acme' });
  });

  it('makes the posting say AI is used, from the first screen on', async () => {
    prisma.job.findUnique.mockResolvedValue(job(false));
    const result = await screens.inviteBatch(employer, 'job-1', { candidateIds: ['cand-1'] });
    expect(prisma.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { usesAi: true } });
    expect(result.postingNowSaysAi).toBe(true);
  });

  it("doesn't for a video round, which the employer judges, not the AI", async () => {
    prisma.job.findUnique.mockResolvedValue(job(false));
    const result = await screens.inviteBatch(employer, 'job-1', { candidateIds: ['cand-1'], mode: 'video' });
    expect(prisma.job.update).not.toHaveBeenCalled();
    expect(result.postingNowSaysAi).toBe(false);
  });

  it('leaves a posting that already says so alone, and changes nothing when no one was screened', async () => {
    prisma.job.findUnique.mockResolvedValue(job(true));
    await expect(screens.inviteBatch(employer, 'job-1', { candidateIds: ['cand-1'] })).resolves.toMatchObject({ postingNowSaysAi: false });

    prisma.job.findUnique.mockResolvedValue(job(false));
    prisma.application.findMany.mockResolvedValue([]); // not an applicant: nobody screened
    await expect(screens.inviteBatch(employer, 'job-1', { candidateIds: ['stranger'] })).resolves.toMatchObject({ postingNowSaysAi: false });
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});

describe('the posting, copied to job feeds and search engines', () => {
  const live = {
    id: 'job-1', title: 'Nurse', description: 'Care for patients.', location: 'Toronto, ON', isRemote: false,
    employmentType: 'full-time', category: null, salaryMin: 60000, salaryMax: 80000, salaryCurrency: 'CAD',
    salaryPeriod: 'yearly', existingVacancy: true, usesAi: true, publishedAt: new Date('2026-10-01'),
    createdAt: new Date('2026-10-01'), applicationDeadline: null, companyName: 'Acme', postedBy: null,
  };
  it('carries the same statements as the posting itself', async () => {
    // Built here: the other blocks reset every mock before each of their tests.
    const feed = new JobFeedService(
      {
        job: { findMany: jest.fn().mockResolvedValue([live]), findFirst: jest.fn().mockResolvedValue(live) },
      } as unknown as PrismaService,
      new ConfigService({ FRONTEND_URL: 'https://coral.example' }),
    );
    const xml = await feed.buildXmlFeed();
    expect(xml).toContain('Care for patients.\n\nThis posting is for an existing vacancy.\nArtificial intelligence is used');
    const jsonLd = await feed.buildJsonLd('job-1');
    expect(jsonLd?.description).toBe(
      'Care for patients.\n\nThis posting is for an existing vacancy.\nArtificial intelligence is used to screen, assess or select applicants for this position.',
    );
  });
});
