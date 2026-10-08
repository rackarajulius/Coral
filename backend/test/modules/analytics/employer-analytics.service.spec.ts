import { NotFoundException } from '@nestjs/common';
import { EmployerAnalyticsService } from '../../../src/analytics/employer-analytics.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CompanyContextService } from '../../../src/company/company-context.service';

describe('EmployerAnalyticsService funnel', () => {
  const jobFindFirst = jest.fn();
  const jobFindMany = jest.fn();
  const eventGroupBy = jest.fn();
  const metricAggregate = jest.fn();
  const applicationFindMany = jest.fn();
  const service = new EmployerAnalyticsService(
    {
      job: { findFirst: jobFindFirst, findMany: jobFindMany },
      analyticsEvent: { groupBy: eventGroupBy },
      employerMetricDaily: { aggregate: metricAggregate },
      application: { findMany: applicationFindMany },
    } as unknown as PrismaService,
    { memberUserIds: jest.fn().mockResolvedValue(['owner', 'colleague']) } as unknown as CompanyContextService,
  );
  const user = { id: 'owner' } as Parameters<EmployerAnalyticsService['funnel']>[0];

  beforeEach(() => {
    jobFindFirst.mockReset();
    jobFindMany.mockReset();
    eventGroupBy.mockReset();
    metricAggregate.mockReset();
    applicationFindMany.mockReset();
  });

  it('rejects a job outside the caller company before reading its applications', async () => {
    jobFindFirst.mockResolvedValue(null);

    await expect(service.funnel(user, 30, 'other-job')).rejects.toBeInstanceOf(NotFoundException);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: 'other-job', postedById: { in: ['owner', 'colleague'] } },
      select: { id: true },
    });
    expect(applicationFindMany).not.toHaveBeenCalled();
    expect(eventGroupBy).not.toHaveBeenCalled();
  });

  it('uses job-specific reach and reports current statuses without invented conversion', async () => {
    jobFindFirst.mockResolvedValue({ id: 'owned-job' });
    eventGroupBy.mockResolvedValue([
      { type: 'job_view', _count: { _all: 10 } },
      { type: 'apply_click', _count: { _all: 4 } },
    ]);
    applicationFindMany.mockResolvedValue([
      { status: 'rejected' }, { status: 'interviewing' }, { status: 'hired' },
    ]);

    const result = await service.funnel(user, 30, 'owned-job');

    expect(eventGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ jobId: 'owned-job', employerId: { in: ['owner', 'colleague'] } }),
    }));
    expect(result.reach[0]).toMatchObject({ stage: 'Job Views', volume: 10 });
    expect(result.pipeline.find((stage) => stage.stage === 'Rejected'))
      .toMatchObject({ volume: 1, conversionFromPrev: null });
    expect(result.pipeline.find((stage) => stage.stage === 'Interviewing'))
      .toMatchObject({ volume: 1, conversionFromPrev: null });
  });
});
