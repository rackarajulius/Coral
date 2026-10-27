import { PipelineStage, ScheduledTask, ScheduledTaskType } from '@prisma/client';
import { AutomationsService } from '../../../src/automations/automations.service';

function collaborator<T>(value: unknown): T { return value as T; }

const task = {
  id: 'task-a',
  type: ScheduledTaskType.SAVED_NOT_CONTACTED,
  createdById: 'employer-a',
  configKey: '',
  config: {},
} as unknown as ScheduledTask;

function harness(rows: {
  saved: string[];
  written?: string[];
  applied?: string[];
  reachable?: string[];
}) {
  const prisma = {
    shortlistItem: {
      findMany: jest.fn().mockResolvedValue(rows.saved.map((candidateId) => ({ candidateId }))),
    },
    outreachMessage: {
      findMany: jest.fn().mockResolvedValue((rows.written ?? []).map((candidateId) => ({ candidateId }))),
    },
    application: {
      findMany: jest.fn().mockResolvedValue((rows.applied ?? []).map((applicantId) => ({ applicantId }))),
    },
    jobSeekerProfile: {
      findMany: jest.fn().mockResolvedValue(
        (rows.reachable ?? rows.saved).map((userId) => ({ userId })),
      ),
    },
  };
  const companyContext = { memberUserIds: jest.fn().mockResolvedValue(['employer-a', 'colleague-a']) };
  const service = new AutomationsService(
    collaborator(prisma), collaborator(companyContext), collaborator({}),
  );
  return { service, prisma };
}

describe('Saved but never contacted', () => {
  it('counts people, once each, who were saved and never written to', async () => {
    const { service } = harness({
      // Saved into two projects: still one person.
      saved: ['cand-a', 'cand-a', 'cand-b', 'cand-c', 'cand-d', 'cand-e'],
      written: ['cand-b'],
      applied: ['cand-c'],
      // Turned discovery off since being saved, so outreach would refuse them.
      reachable: ['cand-a', 'cand-b', 'cand-c', 'cand-e'],
    });

    const outcome = await service.execute(task);

    expect(outcome.count).toBe(2);
    expect(outcome.message).toBe(
      '2 people your team saved more than 3 days ago have never been written to.',
    );
  });

  it('looks only at the company’s own projects, past the grace period, before anyone moved them on', async () => {
    const { service, prisma } = harness({ saved: ['cand-a'] });
    const before = Date.now();

    await service.execute(task);

    const where = prisma.shortlistItem.findMany.mock.calls[0][0].where;
    expect(where.shortlist).toEqual({ employerId: { in: ['employer-a', 'colleague-a'] } });
    expect(where.applicationId).toBeNull();
    expect(where.OR).toEqual([{ stage: null }, { stage: PipelineStage.SOURCED }]);
    expect(before - where.addedAt.lt.getTime()).toBeGreaterThanOrEqual(3 * 86_400_000);

    // A colleague's message counts; a cancelled one does not.
    const outreachWhere = prisma.outreachMessage.findMany.mock.calls[0][0].where;
    expect(outreachWhere.employerId).toEqual({ in: ['employer-a', 'colleague-a'] });
    expect(outreachWhere.status).toEqual({ not: 'cancelled' });
  });

  it('reports zero honestly, and stops early, when nobody is waiting', async () => {
    const { service, prisma } = harness({ saved: [] });

    const outcome = await service.execute(task);

    expect(outcome).toEqual({
      count: 0,
      title: 'Everyone saved has heard from you',
      message: 'Everyone your team saved has been written to, or was saved in the last 3 days.',
    });
    expect(prisma.outreachMessage.findMany).not.toHaveBeenCalled();
  });

  it('never puts a name in the notification', async () => {
    const { service } = harness({ saved: ['cand-a'] });
    const outcome = await service.execute(task);
    expect(outcome.message).toBe('1 person your team saved more than 3 days ago has never been written to.');
  });
});
