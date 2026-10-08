import { ReviewsService } from '../../../src/reviews/reviews.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ReviewModerationService } from '../../../src/reviews/review-moderation.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { CompanyContextService } from '../../../src/company/company-context.service';

describe('ReviewsService employer dashboard', () => {
  const findMany = jest.fn();
  const memberUserIds = jest.fn().mockResolvedValue(['member-a', 'member-b']);
  const service = new ReviewsService(
    { companyReview: { findMany } } as unknown as PrismaService,
    {} as ReviewModerationService,
    {} as NotificationsService,
    { memberUserIds } as unknown as CompanyContextService,
  );
  const user = { id: 'member-a' } as Parameters<ReviewsService['forEmployer']>[0];

  beforeEach(() => findMany.mockReset());

  it('calculates the overview from published reviews across company members', async () => {
    const now = new Date();
    const publishedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const respondedAt = new Date(publishedAt.getTime() + 2 * 3_600_000);
    findMany.mockResolvedValue([
      { rating: 5, categoryRatings: { communication: 5 }, publishedAt, response: { createdAt: respondedAt } },
      { rating: 3, categoryRatings: { communication: 3 }, publishedAt, response: null },
    ]);

    const result = await service.employerOverview(user);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employerId: { in: ['member-a', 'member-b'] }, status: 'published' },
    }));
    expect(result).toMatchObject({
      total: 2,
      averageRating: 4,
      categoryAverages: { communication: 4 },
      responded: 1,
      unanswered: 1,
      responseRate: 50,
      averageResponseHours: 2,
    });
    expect(result.monthly.find((month) => month.month === publishedAt.toISOString().slice(0, 7)))
      .toMatchObject({ count: 2, averageRating: 4 });
  });

  it('uses all ratings for summary even when the visible list is capped', async () => {
    findMany
      .mockResolvedValueOnce([{ id: 'recent', rating: 5, categoryRatings: null, response: null, publishedAt: new Date() }])
      .mockResolvedValueOnce(Array.from({ length: 101 }, () => ({ rating: 1, categoryRatings: null })));

    const result = await service.forEmployer(user);

    expect(result.total).toBe(101);
    expect(result.averageRating).toBe(1);
    expect(result.reviews).toHaveLength(1);
    expect(findMany.mock.calls[0][0].take).toBe(100);
  });
});
