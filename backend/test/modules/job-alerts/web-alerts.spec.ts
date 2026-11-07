import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobAlertsService, alertTitleTerms } from '../../../src/job-alerts/job-alerts.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { ResumeMatcherService } from '../../../src/resume-matcher/resume-matcher.service';
import { CandidateJob } from '../../../src/resume-matcher/job-sources/types';

const NOW = new Date('2026-10-16T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const prisma = {
  job: { findMany: jest.fn() },
  jobAlert: { findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  jobAlertWebMatch: { findMany: jest.fn(), createMany: jest.fn() },
};
const create = jest.fn();
const findWebJobs = jest.fn();

function service(config: Record<string, string> = {}) {
  return new JobAlertsService(
    prisma as unknown as PrismaService,
    {} as never,
    new ConfigService(config),
    { create } as unknown as NotificationsService,
    {} as never,
    { findWebJobs } as unknown as ResumeMatcherService,
  );
}

const alert = (over: Record<string, unknown> = {}) => ({
  id: 'alert-1',
  userId: 'user-1',
  name: 'Nurse',
  keywords: [],
  location: 'Toronto, ON',
  jobType: null,
  experienceLevel: null,
  salaryMin: null,
  frequency: 'daily',
  webCheckedAt: null,
  user: { id: 'user-1', role: 'JOB_SEEKER', subscriptionTier: 'free', jobSeekerProfile: { notificationSettings: null } },
  ...over,
});

const web = (id: string, over: Partial<CandidateJob> = {}): CandidateJob => ({
  id: `jsearch:${id}`, title: `Nurse ${id}`, company: 'Acme Health', location: 'Toronto, ON, CA',
  description: '', source: 'jsearch', url: `https://jobs.example/${id}`, postedAt: '2026-10-15T00:00:00.000Z', ...over,
});

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());
beforeEach(() => {
  jest.resetAllMocks();
  prisma.jobAlert.findMany.mockResolvedValue([alert()]);
  prisma.jobAlert.count.mockResolvedValue(0);
  prisma.jobAlert.update.mockResolvedValue({});
  prisma.jobAlertWebMatch.findMany.mockResolvedValue([]);
  prisma.jobAlertWebMatch.createMany.mockResolvedValue({ count: 0 });
  create.mockResolvedValue({ id: 'note-1' });
  findWebJobs.mockResolvedValue({ jobs: [web('a'), web('b')], searched: ['adzuna', 'jsearch'] });
});

const stored = () => (prisma.jobAlertWebMatch.createMany.mock.calls[0]?.[0]?.data ?? []) as Array<Record<string, unknown>>;

describe("an alert's title", () => {
  it('is read as the words that matter', () => {
    expect(alertTitleTerms('Senior Product Designer')).toEqual(['senior', 'product', 'designer']);
    expect(alertTitleTerms('Nurse jobs in Toronto')).toEqual(['nurse', 'toronto']);
    expect(alertTitleTerms('C++ / Node.js developer.')).toEqual(['c++', 'node.js', 'developer']);
  });

  it('decides which jobs here match, where it used to be ignored', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: '1', title: 'Senior Product Designer', description: '', skills: [] },
      { id: '2', title: 'Warehouse Associate', description: '', skills: [] },
      { id: '3', title: 'Product Designer', description: 'Figma daily.', skills: [] },
    ]);
    const matchesFor = async (name: string, keywords: string[]) => {
      const found = await (service() as unknown as {
        findMatches: (a: unknown, since: Date, limit: number) => Promise<Array<{ id: string }>>;
      }).findMatches({ ...alert({ name, keywords, location: null }) }, new Date(0), 10);
      return found.map((j) => j.id);
    };
    expect(await matchesFor('Senior Product Designer', [])).toEqual(['1']);
    // Additional keywords widen the alert: any one of them will do.
    expect(await matchesFor('Senior Product Designer', ['figma'])).toEqual(['1', '3']);
  });
});

describe('checking the web for an alert', () => {
  it('searches its title and place, keeps the new jobs, and says so in the app', async () => {
    await expect(service().checkWebForDueAlerts(NOW)).resolves.toEqual({ checked: 1, notified: 1 });

    expect(findWebJobs).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      { query: 'Nurse', location: 'Toronto, ON' },
      { without: [] },
    );
    expect(stored().map((r) => [r.jobId, r.jobKey, r.alertId, r.userId])).toEqual([
      ['jsearch:a', 'nurse a|acme health', 'alert-1', 'user-1'],
      ['jsearch:b', 'nurse b|acme health', 'alert-1', 'user-1'],
    ]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      type: 'job_alert',
      title: '2 new jobs from across the web for “Nurse”',
      message: 'Nurse a · Acme Health · Toronto, ON, CA\nNurse b · Acme Health · Toronto, ON, CA',
      link: '/activity?tab=alerts&alert=alert-1',
    }));
    expect(prisma.jobAlert.update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { webCheckedAt: NOW, webUsedJSearch: true },
    });
  });

  it('never announces a job twice, even relisted under a new id', async () => {
    prisma.jobAlertWebMatch.findMany.mockResolvedValue([{ jobKey: 'nurse a|acme health' }]);
    findWebJobs.mockResolvedValue({ jobs: [web('a', { id: 'adzuna:other-id', source: 'adzuna' }), web('b')], searched: ['adzuna'] });
    await service().checkWebForDueAlerts(NOW);
    expect(stored().map((r) => r.jobId)).toEqual(['jsearch:b']);
    expect(create.mock.calls[0][0].title).toBe('1 new job from across the web for “Nurse”');
  });

  it('leaves out only what clearly does not fit the alert', async () => {
    prisma.jobAlert.findMany.mockResolvedValue([
      alert({ jobType: 'Full-time', salaryMin: 80000, webCheckedAt: new Date(NOW.getTime() - DAY) }),
    ]);
    findWebJobs.mockResolvedValue({
      jobs: [
        web('old', { postedAt: new Date(NOW.getTime() - 4 * DAY).toISOString() }),
        web('parttime', { employmentType: 'part_time' }),
        web('lowpay', { yearlyPay: { min: 40000, max: 50000, currency: 'CAD' } }),
        // Saying nothing about type, pay or date is not a reason to leave a job out.
        web('silent', { postedAt: undefined }),
        web('fits', { employmentType: 'full_time', yearlyPay: { min: 85000, max: 95000, currency: 'CAD' } }),
      ],
      searched: ['adzuna'],
    });
    await service().checkWebForDueAlerts(NOW);
    expect(stored().map((r) => r.jobId)).toEqual(['jsearch:silent', 'jsearch:fits']);
  });

  it('reads "Remote" as remote work across the country, not a place', async () => {
    prisma.jobAlert.findMany.mockResolvedValue([alert({ location: 'Remote' })]);
    findWebJobs.mockResolvedValue({ jobs: [web('office', { workplace: 'onsite' }), web('home', { workplace: 'remote' })], searched: [] });
    await service().checkWebForDueAlerts(NOW);
    expect(findWebJobs.mock.calls[0][1]).toEqual({ query: 'Nurse remote', location: '' });
    expect(stored().map((r) => r.jobId)).toEqual(['jsearch:home']);
  });

  it('leaves JSearch out once the day’s allowance for alerts is spent', async () => {
    prisma.jobAlert.count.mockResolvedValue(2);
    findWebJobs.mockResolvedValue({ jobs: [], searched: ['adzuna'] });
    await service().checkWebForDueAlerts(NOW);
    expect(findWebJobs.mock.calls[0][2]).toEqual({ without: ['jsearch'] });
    expect(prisma.jobAlert.update.mock.calls[0][0].data).toEqual({ webCheckedAt: NOW, webUsedJSearch: false });
  });

  it('spends the allowance as it goes, within one pass', async () => {
    prisma.jobAlert.count.mockResolvedValue(1);
    prisma.jobAlert.findMany.mockResolvedValue([alert({ id: 'a1' }), alert({ id: 'a2' })]);
    await service().checkWebForDueAlerts(NOW);
    expect(findWebJobs.mock.calls.map((c) => c[2])).toEqual([{ without: [] }, { without: ['jsearch'] }]);
  });

  it('keeps the jobs but stays quiet when job-alert notifications are off', async () => {
    prisma.jobAlert.findMany.mockResolvedValue([
      alert({ user: { id: 'user-1', role: 'JOB_SEEKER', subscriptionTier: 'free', jobSeekerProfile: { notificationSettings: { pushJobAlerts: false } } } }),
    ]);
    await expect(service().checkWebForDueAlerts(NOW)).resolves.toEqual({ checked: 1, notified: 0 });
    expect(stored()).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
  });

  it('marks an alert checked without searching when the plan has no web', async () => {
    findWebJobs.mockResolvedValue(null);
    await service().checkWebForDueAlerts(NOW);
    expect(prisma.jobAlertWebMatch.createMany).not.toHaveBeenCalled();
    expect(prisma.jobAlert.update).toHaveBeenCalledWith({ where: { id: 'alert-1' }, data: { webCheckedAt: NOW, webUsedJSearch: false } });
  });

  it('tries again later when a check fails', async () => {
    findWebJobs.mockRejectedValue(new Error('db down'));
    await expect(service().checkWebForDueAlerts(NOW)).resolves.toEqual({ checked: 0, notified: 0 });
    expect(prisma.jobAlert.update).not.toHaveBeenCalled();
  });

  it('can be switched off', async () => {
    await service({ JOB_ALERTS_WEB_CHECKS_PER_PASS: '0' }).checkWebForDueAlerts(NOW);
    expect(prisma.jobAlert.findMany).not.toHaveBeenCalled();
  });
});
