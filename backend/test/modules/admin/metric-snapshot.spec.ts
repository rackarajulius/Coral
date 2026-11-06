import { Logger } from '@nestjs/common';
import { MetricSnapshotService } from '../../../src/admin/metric-snapshot.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

type SnapshotWrite = {
  where: { key_capturedOn: { key: string; capturedOn: Date } };
  create: { key: string; value: number; capturedOn: Date };
  update: { value: number };
};

function fixture(options: { failAt?: number; verified?: number; revenue?: number | null } = {}) {
  const failure = new Error('Database unavailable');
  const activity = { active: 0, peak: 0, completed: 0, started: 0 };
  const query = <T>(result: T): Promise<T> => {
    const current = ++activity.started;
    activity.active++;
    activity.peak = Math.max(activity.peak, activity.active);
    // Leave each operation pending for a turn so accidental parallel queries
    // are observable even without a live database or timing assumptions.
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        activity.active--;
        activity.completed++;
        if (current === options.failAt) reject(failure);
        else resolve(result);
      });
    });
  };

  const prisma = {
    user: {
      count: jest.fn(({ where }: { where: { role: string; status?: string; postedJobs?: unknown } }) =>
        query(where.role === 'JOB_SEEKER' ? 24 : where.status ? 2 : where.postedJobs ? 6 : 10)),
    },
    employerProfile: { count: jest.fn(() => query(options.verified ?? 7)) },
    job: { count: jest.fn(() => query(8)) },
    application: { count: jest.fn(() => query(31)) },
    paymentTransaction: {
      aggregate: jest.fn(() => query({ _sum: { amount: options.revenue === undefined ? 12500 : options.revenue } })),
    },
    metricSnapshot: { upsert: jest.fn((args: SnapshotWrite) => query(args.create)) },
  };
  return { service: new MetricSnapshotService(prisma as unknown as PrismaService), prisma, activity, failure };
}

describe('MetricSnapshotService connection use', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('keeps reads and writes to one active query while retaining all metric values and day keys', async () => {
    const { service, prisma, activity } = fixture();

    await service.captureToday();

    expect(activity).toEqual({ active: 0, peak: 1, completed: 17, started: 17 });
    const writes = prisma.metricSnapshot.upsert.mock.calls.map(([args]) => args);
    expect(Object.fromEntries(writes.map(({ create }) => [create.key, create.value]))).toEqual({
      'employers.total': 10,
      'employers.active': 6,
      'employers.suspended': 2,
      'employers.verified': 7,
      'employers.pending': 3,
      'jobseekers.total': 24,
      'listings.active': 8,
      'applications.total': 31,
      'revenue.mtd': 12500,
    });
    const capturedOn = writes[0].create.capturedOn;
    expect(capturedOn.toISOString()).toMatch(/T00:00:00\.000Z$/);
    for (const { create, update, where } of writes) {
      expect(create.capturedOn).toEqual(capturedOn);
      expect(where).toEqual({ key_capturedOn: { key: create.key, capturedOn } });
      expect(update).toEqual({ value: create.value });
    }
  });

  it('coalesces overlapping captures but lets a completed capture be refreshed later', async () => {
    const { service, prisma, activity } = fixture();

    await Promise.all([service.captureToday(), service.captureToday(), service.captureToday()]);

    expect(prisma.user.count).toHaveBeenCalledTimes(4);
    expect(prisma.metricSnapshot.upsert).toHaveBeenCalledTimes(9);
    expect(activity.peak).toBe(1);

    await service.captureToday();
    expect(prisma.user.count).toHaveBeenCalledTimes(8);
    expect(prisma.metricSnapshot.upsert).toHaveBeenCalledTimes(18);
    expect(activity.peak).toBe(1);
  });

  it.each([1, 10])('releases the in-flight capture after query %i fails and allows retry', async (failAt) => {
    const { service, prisma, activity, failure } = fixture({ failAt });

    const outcomes = await Promise.allSettled([service.captureToday(), service.captureToday()]);

    expect(outcomes).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ]);
    expect(activity.started).toBe(failAt);
    const writesBeforeRetry = prisma.metricSnapshot.upsert.mock.calls.length;

    await expect(service.captureToday()).resolves.toBeUndefined();
    expect(prisma.metricSnapshot.upsert).toHaveBeenCalledTimes(writesBeforeRetry + 9);
    expect(activity.peak).toBe(1);
    expect(activity.active).toBe(0);
  });

  it('keeps the zero defaults for missing revenue and a negative pending count', async () => {
    const { service, prisma } = fixture({ verified: 12, revenue: null });

    await service.captureToday();

    const values = Object.fromEntries(prisma.metricSnapshot.upsert.mock.calls.map(([{ create }]) => [create.key, create.value]));
    expect(values['employers.pending']).toBe(0);
    expect(values['revenue.mtd']).toBe(0);
  });
});
