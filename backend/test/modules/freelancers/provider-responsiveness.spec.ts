import { NotFoundException } from '@nestjs/common';
import { CitiesService } from '../../../src/locations/cities.service';
import { FreelancersService } from '../../../src/freelancers/freelancers.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  GRACE_DAYS, MIN_REQUESTS, MIN_TIMED, measureResponsiveness, type RequestTiming,
} from '../../../src/freelancers/provider-responsiveness';

const NOW = new Date('2026-10-22T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A request made `daysAgo`, first answered `answeredAfterHours` later (if at all). */
function request(daysAgo: number, answeredAfterHours: number | null, status = answeredAfterHours === null ? 'pending' : 'accepted'): RequestTiming {
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    status, createdAt,
    recipientRespondedAt: answeredAfterHours === null ? null : new Date(createdAt.getTime() + answeredAfterHours * HOUR),
  };
}
const answered = (count: number, hours = 2) => Array.from({ length: count }, (_, i) => request(10 + i, hours));

describe('How a provider replies to requests', () => {
  it('says nothing until enough requests count, and says how many are needed', () => {
    const few = measureResponsiveness(answered(MIN_REQUESTS - 1), NOW);
    expect(few).toMatchObject({ available: false, considered: MIN_REQUESTS - 1, replied: MIN_REQUESTS - 1, needed: MIN_REQUESTS });
    expect(measureResponsiveness(answered(MIN_REQUESTS), NOW).available).toBe(true);
  });

  it('gives a new unanswered request a week before it counts against them', () => {
    const fresh = request(GRACE_DAYS - 1, null);
    const overdue = request(GRACE_DAYS + 1, null);
    expect(measureResponsiveness([...answered(5), fresh], NOW)).toMatchObject({ considered: 5, replied: 5 });
    expect(measureResponsiveness([...answered(5), overdue], NOW)).toMatchObject({ considered: 6, replied: 5 });
  });

  it('never counts what the client ended, or a block, on either side', () => {
    const ignoredThenWithdrawn = request(30, null, 'withdrawn');
    const answeredThenWithdrawn = request(30, 1, 'withdrawn');
    const blocked = request(30, null, 'blocked');
    expect(measureResponsiveness([...answered(5), ignoredThenWithdrawn, answeredThenWithdrawn, blocked], NOW))
      .toMatchObject({ considered: 5, replied: 5 });
  });

  it('counts an old decline with no time as answered, but never gives it a time', () => {
    const oldDecline = request(40, null, 'declined');
    const result = measureResponsiveness([...answered(MIN_TIMED - 1), oldDecline], NOW);
    expect(result).toMatchObject({ considered: MIN_TIMED, replied: MIN_TIMED, available: true });
    // Only four timed answers: not enough to say how quickly.
    expect(result.medianHoursToReply).toBeNull();
  });

  it('uses the median, so one request left for months cannot move it', () => {
    const quick = answered(5, 3);
    const months = request(200, 24 * 90);
    expect(measureResponsiveness(quick, NOW).medianHoursToReply).toBe(3);
    expect(measureResponsiveness([...quick, months], NOW).medianHoursToReply).toBe(3);
  });

  it('takes the middle two of an even count', () => {
    const hours = [1, 2, 4, 8, 16, 32].map((h, i) => request(10 + i, h));
    expect(measureResponsiveness(hours, NOW).medianHoursToReply).toBe(6);
  });

  it('counts only the past year', () => {
    expect(measureResponsiveness([...answered(4), request(400, 1)], NOW)).toMatchObject({ considered: 4, available: false });
  });
});

describe('Reply figures through the service', () => {
  function harness(published = true) {
    const ready = {
      id: 'p', userId: 'provider', providerEnabled: true, publicPreviewEnabled: true, category: 'design',
      headline: 'Product designer', summary: 'I design accessible interfaces and practical products.',
      skills: ['Design'], portfolioUrl: 'https://example.com/work', githubUrl: null,
      user: { id: 'provider', displayName: null, firstName: 'Pro', lastName: 'Member', avatarUrl: null },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'JOB_SEEKER', status: 'ACTIVE' }) },
      freelancerProfile: { findFirst: jest.fn().mockResolvedValue(published ? ready : null) },
      marketplaceRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, service: new FreelancersService(prisma as unknown as PrismaService, {} as CitiesService) };
  }

  it("reads only requests for the person's own services, minus what is never counted", async () => {
    const { service, prisma } = harness();
    await service.getMyResponsiveness('provider');
    expect(prisma.marketplaceRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        recipientId: 'provider', recipientCompanyId: null, kind: 'service',
        status: { notIn: ['withdrawn', 'blocked'] }, createdAt: { gte: expect.any(Date) },
      }),
      // Times and status only: never who asked or what they wrote.
      select: { status: true, createdAt: true, recipientRespondedAt: true },
    }));
  });

  it('tells visitors nothing below the minimum, and the owner how far off it is', async () => {
    const { service, prisma } = harness();
    prisma.marketplaceRequest.findMany.mockResolvedValue(answered(2));
    await expect(service.getPublicResponsiveness('provider')).resolves.toBeNull();
    await expect(service.getMyResponsiveness('provider')).resolves.toMatchObject({ available: false, considered: 2, needed: MIN_REQUESTS });
  });

  it('shows visitors the figures once there are enough', async () => {
    const { service, prisma } = harness();
    prisma.marketplaceRequest.findMany.mockResolvedValue(answered(6));
    await expect(service.getPublicResponsiveness('provider')).resolves.toMatchObject({ available: true, considered: 6, replied: 6 });
  });

  it('gives a private or unready provider the profile 404, before reading any request', async () => {
    const { service, prisma } = harness(false);
    await expect(service.getPublicResponsiveness('provider')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.marketplaceRequest.findMany).not.toHaveBeenCalled();
  });
});
