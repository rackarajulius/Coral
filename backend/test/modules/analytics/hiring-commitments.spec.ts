import { CompanyContextService } from '../../../src/company/company-context.service';
import { HiringCommitmentsService } from '../../../src/analytics/hiring-commitments.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const DAY = 86_400_000;
const NOW = new Date('2026-10-16T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * DAY);

const job = (over: Record<string, unknown> = {}) => ({
  id: `job-${Math.random().toString(36).slice(2, 7)}`,
  title: 'Nurse',
  description: 'Care for patients.',
  requirements: [] as string[],
  salaryMin: 60000,
  salaryMax: 80000,
  salaryPeriod: 'yearly',
  existingVacancy: true,
  usesAi: false,
  ...over,
});

const interview = (candidateId: string, heldDaysAgo: number, answeredAfterDays: number | null, role = 'Nurse') => ({
  candidateId,
  role,
  scheduledAt: daysAgo(heldDaysAgo),
  outcomeAt: answeredAfterDays === null ? null : daysAgo(heldDaysAgo - answeredAfterDays),
});

function service(jobs: unknown[], interviews: unknown[]) {
  const prisma = {
    job: { findMany: jest.fn().mockResolvedValue(jobs) },
    interview: { findMany: jest.fn().mockResolvedValue(interviews) },
  };
  const context = { memberUserIds: jest.fn().mockResolvedValue(['owner', 'recruiter']) };
  return {
    prisma,
    commitments: new HiringCommitmentsService(prisma as unknown as PrismaService, context as unknown as CompanyContextService),
  };
}

beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
afterAll(() => jest.restoreAllMocks());

describe('what the postings say', () => {
  it("counts the company's live postings by what they state", async () => {
    const { commitments, prisma } = service(
      [
        job(),
        job({ salaryMin: null, salaryMax: null }),
        job({ existingVacancy: null }),
        job({ existingVacancy: false, usesAi: true }),
      ],
      [],
    );
    const { postings } = await commitments.forCompany('owner');
    expect(postings).toEqual({ open: 4, withPay: 3, vacancyStated: 3, futureOpenings: 1, usingAi: 1 });
    // Every member's postings, live ones only.
    expect(prisma.job.findMany.mock.calls[0][0].where).toEqual({
      postedById: { in: ['owner', 'recruiter'] },
      status: { in: ['active'] },
    });
  });
});

describe('hearing back after an interview', () => {
  const answeredInTime = (n: number) => Array.from({ length: n }, (_, i) => interview(`c${i}`, 60, 5 + i));

  it('says nothing below ten judged interviews', async () => {
    const { commitments } = service([], answeredInTime(9));
    expect((await commitments.forCompany('owner')).afterInterview).toMatchObject({
      available: false, measured: 9, withinDeadlineRate: null, medianDaysToOutcome: null,
    });
  });

  it('gives the share told within 45 days, and the typical wait', async () => {
    const { commitments } = service([], [
      ...answeredInTime(8),
      interview('late', 90, 60), // answered, but on day 60
      interview('never', 80, null), // past the deadline with no word
    ]);
    expect((await commitments.forCompany('owner')).afterInterview).toEqual({
      available: true,
      measured: 10,
      deadlineDays: 45,
      withinDeadlineRate: 80,
      medianDaysToOutcome: null, // nine answers: below ten, no median
    });
  });

  it("doesn't judge someone interviewed recently who hasn't heard yet", async () => {
    const { commitments } = service([], [...answeredInTime(10), interview('fresh', 10, null)]);
    expect((await commitments.forCompany('owner')).afterInterview).toMatchObject({
      measured: 10, withinDeadlineRate: 100, medianDaysToOutcome: 9.5,
    });
  });

  it("runs the deadline from the candidate's last interview for a role", async () => {
    const { commitments } = service([], [
      ...answeredInTime(9),
      // Round one answered on day 2, round two never: late, from round two.
      interview('two-rounds', 100, 2),
      interview('two-rounds', 60, null),
    ]);
    expect((await commitments.forCompany('owner')).afterInterview).toMatchObject({ measured: 10, withinDeadlineRate: 90 });
  });

  it('reads an outcome logged before the interview time as no wait, not a negative one', async () => {
    const { commitments } = service([], [...answeredInTime(9), interview('clock', 50, -1)]);
    const facts = (await commitments.forCompany('owner')).afterInterview;
    expect(facts.withinDeadlineRate).toBe(100);
    // Waits 0 (clamped), 5, 6 … 13: the median is between 8 and 9.
    expect(facts.medianDaysToOutcome).toBe(8.5);
  });
});

describe('what the employer can fix', () => {
  it('lists postings missing what candidates and Ontario expect, and interviews running late', async () => {
    const noPay = job({ id: 'no-pay', title: 'Cook', salaryMin: null, salaryMax: null });
    const wide = job({ id: 'wide', title: 'Analyst', salaryMin: 60000, salaryMax: 130000 });
    const unstated = job({ id: 'unstated', title: 'Driver', existingVacancy: null });
    const canadian = job({ id: 'canadian', title: 'Welder', requirements: ['Canadian experience required'] });
    const { commitments } = service([job(), noPay, wide, unstated, canadian], [
      interview('soon', 38, null),
      interview('late', 50, null),
      interview('fine', 20, null),
    ]);
    const { toFix } = await commitments.forEmployer('owner');
    expect(toFix).toEqual({
      missingPay: [{ id: 'no-pay', title: 'Cook' }],
      payRangeTooWide: [{ id: 'wide', title: 'Analyst' }],
      vacancyUnstated: [{ id: 'unstated', title: 'Driver' }],
      canadianExperience: [{ id: 'canadian', title: 'Welder' }],
      outcomesDueSoon: 1,
      outcomesOverdue: 1,
    });
  });

  it('keeps those lists off the public figures', async () => {
    const { commitments } = service([job({ salaryMin: null, salaryMax: null })], []);
    expect(await commitments.forCompany('owner')).not.toHaveProperty('toFix');
  });
});
