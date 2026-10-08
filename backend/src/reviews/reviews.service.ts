import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../common/types/user.types';
import { ReviewModerationService } from './review-moderation.service';
import {
  CreateReviewDto, FlagReviewDto, ModerateReviewDto, RespondToReviewDto,
} from './dto/review.dto';

/**
 * Below this many published reviews, per-review context (role, stage) is
 * hidden. At a small company "Senior Engineer, reached final interview" names
 * one person, and a reviewer who can be identified can be retaliated against.
 */
const MIN_REVIEWS_FOR_CONTEXT = 5;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ReviewModerationService,
    private readonly notifications: NotificationsService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /* ------------------------------ candidate ------------------------------- */

  /**
   * Interactions this person could review but hasn't yet.
   *
   * Drives the "leave a review" prompt: there's no free-text company picker,
   * because a review is only possible where a real interaction exists.
   */
  async reviewable(user: User) {
    const [apps, interviews, existing] = await Promise.all([
      this.prisma.application.findMany({
        where: { applicantId: user.id },
        select: {
          id: true, status: true, appliedAt: true,
          job: { select: { title: true, postedById: true, companyName: true } },
        },
        orderBy: { appliedAt: 'desc' },
        take: 50,
      }),
      this.prisma.interview.findMany({
        where: { candidateId: user.id, status: { in: ['confirmed', 'completed'] } },
        select: { id: true, role: true, employerId: true, scheduledAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.companyReview.findMany({
        where: { authorId: user.id },
        select: { applicationId: true, interviewId: true },
      }),
    ]);

    const usedApps = new Set(existing.map((e) => e.applicationId).filter(Boolean));
    const usedInterviews = new Set(existing.map((e) => e.interviewId).filter(Boolean));

    const companies = await this.companyNames([
      ...apps.map((a) => a.job.postedById),
      ...interviews.map((i) => i.employerId),
    ]);

    return [
      ...apps
        .filter((a) => !usedApps.has(a.id))
        .map((a) => ({
          kind: 'application' as const,
          id: a.id,
          employerId: a.job.postedById,
          company: companies.get(a.job.postedById) ?? a.job.companyName ?? 'An employer',
          role: a.job.title,
          stageReached: this.stageFromStatus(a.status),
          at: a.appliedAt,
        })),
      ...interviews
        .filter((i) => !usedInterviews.has(i.id))
        .map((i) => ({
          kind: 'interview' as const,
          id: i.id,
          employerId: i.employerId,
          company: companies.get(i.employerId) ?? 'An employer',
          role: i.role ?? 'the role',
          stageReached: 'Interviewed',
          at: i.scheduledAt,
        })),
    ];
  }

  /**
   * Writes a review, tied to a verified interaction.
   *
   * The interaction is re-checked here rather than trusted from the client:
   * the id is the entire proof that this person dealt with this employer.
   */
  async create(user: User, dto: CreateReviewDto) {
    if (!dto.applicationId === !dto.interviewId) {
      throw new BadRequestException('Give exactly one application or interview to review.');
    }

    let employerId: string;
    let stageReached: string;

    if (dto.applicationId) {
      const app = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, applicantId: user.id },
        select: { status: true, job: { select: { postedById: true } } },
      });
      if (!app) throw new NotFoundException('Application not found');
      employerId = app.job.postedById;
      stageReached = this.stageFromStatus(app.status);
    } else {
      const interview = await this.prisma.interview.findFirst({
        where: { id: dto.interviewId, candidateId: user.id },
        select: { employerId: true },
      });
      if (!interview) throw new NotFoundException('Interview not found');
      employerId = interview.employerId;
      stageReached = 'Interviewed';
    }

    const checks = await this.moderation.check({ title: dto.title, body: dto.body });
    const status = checks.pass ? 'published' : 'pending';

    let review;
    try {
      review = await this.prisma.companyReview.create({
        data: {
          employerId,
          authorId: user.id,
          applicationId: dto.applicationId ?? null,
          interviewId: dto.interviewId ?? null,
          stageReached,
          rating: dto.rating,
          categoryRatings: (dto.categoryRatings ?? {}) as unknown as Prisma.InputJsonValue,
          title: dto.title.trim(),
          body: dto.body.trim(),
          status,
          checkResults: checks as unknown as Prisma.InputJsonValue,
          publishedAt: status === 'published' ? new Date() : null,
        },
      });
    } catch (err) {
      // The unique indexes on applicationId/interviewId are the guard against
      // one interaction producing many reviews.
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('You have already reviewed this.');
      }
      throw err;
    }

    if (status === 'published') {
      await this.notifications
        .create({
          userId: employerId,
          type: 'review',
          title: 'You received a new review',
          message: `${dto.rating}/5 · "${dto.title.slice(0, 60)}"`,
          link: '/employers/reviews',
        })
        .catch(() => undefined);
    }

    return {
      id: review.id,
      status,
      // Say plainly why it's waiting, rather than leaving it silently invisible.
      pendingReason: checks.pass
        ? null
        : checks.findings.map((f) => f.detail).join(' ') ||
          'Held for a person to read before publishing.',
    };
  }

  /** The author's own reviews, including ones still pending. */
  async mine(user: User) {
    const rows = await this.prisma.companyReview.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { response: true },
    });
    const companies = await this.companyNames(rows.map((r) => r.employerId));
    return rows.map((r) => ({
      id: r.id,
      company: companies.get(r.employerId) ?? 'An employer',
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt,
      response: r.response ? { body: r.response.body, at: r.response.createdAt } : null,
    }));
  }

  /* -------------------------------- public -------------------------------- */

  /**
   * Published reviews for a company, anonymised.
   *
   * Never returns authorId. Per-review context is withheld entirely until the
   * company has enough reviews that it can't single anyone out.
   */
  async forCompany(employerId: string | string[]) {
    const where = {
      employerId: Array.isArray(employerId) ? { in: employerId } : employerId,
      status: 'published',
    };
    const [rows, ratings] = await Promise.all([
      this.prisma.companyReview.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: 100,
        include: { response: true },
      }),
      this.prisma.companyReview.findMany({
        where,
        select: { rating: true, categoryRatings: true },
      }),
    ]);

    const showContext = ratings.length >= MIN_REVIEWS_FOR_CONTEXT;

    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: ratings.filter((r) => r.rating === star).length,
    }));

    return {
      total: ratings.length,
      // Null rather than 0 when there are none — an unrated company is not a
      // company rated zero.
      averageRating:
        ratings.length > 0
          ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10
          : null,
      distribution,
      categoryAverages: this.categoryAverages(ratings),
      contextHidden: !showContext,
      contextNote: showContext
        ? null
        : 'Role and stage are hidden until this company has more reviews, so no single reviewer can be identified.',
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        categoryRatings: r.categoryRatings,
        publishedAt: r.publishedAt,
        // Withheld at low volume — these two together identify a person.
        stageReached: showContext ? r.stageReached : null,
        response: r.response ? { body: r.response.body, at: r.response.createdAt } : null,
      })),
    };
  }

  /* ------------------------------- employer -------------------------------- */

  /**
   * The company's reviews. Same anonymity rules as the public view.
   *
   * Company-wide because a review is about the company: a candidate who dealt
   * with one recruiter is describing the employer, and scattering those across
   * whichever colleague happened to handle them would let a poor rating go
   * unanswered simply because that person no longer looks at the dashboard.
   */
  async forEmployer(user: User) {
    return this.forCompany(await this.companyContext.memberUserIds(user.id));
  }

  /** Metrics for the employer dashboard, across every published company review. */
  async employerOverview(user: User) {
    const employerIds = await this.companyContext.memberUserIds(user.id);
    const rows = await this.prisma.companyReview.findMany({
      where: { employerId: { in: employerIds }, status: 'published' },
      select: {
        rating: true,
        categoryRatings: true,
        publishedAt: true,
        response: { select: { createdAt: true } },
      },
    });

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + index, 1));
      return { month: date.toISOString().slice(0, 7), count: 0, ratingSum: 0, averageRating: null as number | null };
    });
    let responded = 0;
    let responseHours = 0;
    let timedResponses = 0;
    for (const row of rows) {
      if (row.response) {
        responded++;
        if (row.publishedAt) {
          responseHours += Math.max(0, row.response.createdAt.getTime() - row.publishedAt.getTime()) / 3_600_000;
          timedResponses++;
        }
      }
      if (!row.publishedAt || row.publishedAt < monthStart) continue;
      const index = (row.publishedAt.getUTCFullYear() - monthStart.getUTCFullYear()) * 12
        + row.publishedAt.getUTCMonth() - monthStart.getUTCMonth();
      if (index >= 0 && index < 12) {
        monthly[index].count++;
        monthly[index].ratingSum += row.rating;
      }
    }

    const total = rows.length;
    return {
      total,
      averageRating: total ? Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / total * 10) / 10 : null,
      distribution: [1, 2, 3, 4, 5].map((star) => ({ star, count: rows.filter((row) => row.rating === star).length })),
      categoryAverages: this.categoryAverages(rows),
      responded,
      unanswered: total - responded,
      responseRate: total ? Math.round(responded / total * 100) : null,
      averageResponseHours: timedResponses ? Math.round(responseHours / timedResponses * 10) / 10 : null,
      monthly: monthly.map(({ month, count, ratingSum }) => ({
        month,
        count,
        averageRating: count ? Math.round(ratingSum / count * 10) / 10 : null,
      })),
    };
  }

  /** Right of reply. There is deliberately no employer delete path. */
  async respond(user: User, reviewId: string, dto: RespondToReviewDto) {
    const review = await this.prisma.companyReview.findFirst({
      where: {
        id: reviewId,
        employerId: { in: await this.companyContext.memberUserIds(user.id) },
        status: 'published',
      },
      select: { id: true, authorId: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const response = await this.prisma.reviewResponse.upsert({
      where: { reviewId },
      create: { reviewId, employerId: user.id, body: dto.body.trim() },
      update: { body: dto.body.trim() },
    });

    await this.notifications
      .create({
        userId: review.authorId,
        type: 'review',
        title: 'The employer replied to your review',
        message: dto.body.slice(0, 100),
        link: '/activity',
      })
      .catch(() => undefined);

    return { id: response.id, body: response.body, at: response.createdAt };
  }

  /** Anyone may report a review; only an admin resolves it. */
  async flag(user: User, reviewId: string, dto: FlagReviewDto) {
    const review = await this.prisma.companyReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.reviewFlag.create({
      data: {
        reviewId,
        reporterId: user.id,
        reason: dto.reason,
        detail: dto.detail?.trim() || null,
      },
    });
    return { flagged: true };
  }

  /* --------------------------------- admin --------------------------------- */

  /** Reviews awaiting a decision, plus anything that's been flagged. */
  async moderationQueue() {
    const [pending, flagged] = await Promise.all([
      this.prisma.companyReview.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      this.prisma.companyReview.findMany({
        where: { status: 'published', flags: { some: { resolvedAt: null } } },
        orderBy: { createdAt: 'asc' },
        include: { flags: { where: { resolvedAt: null } } },
        take: 100,
      }),
    ]);

    const companies = await this.companyNames([
      ...pending.map((r) => r.employerId),
      ...flagged.map((r) => r.employerId),
    ]);
    const shape = (r: (typeof pending)[number]) => ({
      id: r.id,
      company: companies.get(r.employerId) ?? 'An employer',
      rating: r.rating,
      title: r.title,
      body: r.body,
      stageReached: r.stageReached,
      status: r.status,
      checkResults: r.checkResults,
      createdAt: r.createdAt,
    });

    return {
      pending: pending.map(shape),
      flagged: flagged.map((r) => ({
        ...shape(r),
        flags: r.flags.map((f) => ({ reason: f.reason, detail: f.detail, at: f.createdAt })),
      })),
    };
  }

  async moderate(admin: User, reviewId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.companyReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.companyReview.update({
      where: { id: reviewId },
      data: {
        status: dto.action === 'publish' ? 'published' : 'removed',
        publishedAt: dto.action === 'publish' ? (review.publishedAt ?? new Date()) : review.publishedAt,
        moderationNote: dto.note?.trim() || null,
      },
    });

    await this.prisma.reviewFlag.updateMany({
      where: { reviewId, resolvedAt: null },
      data: { resolvedAt: new Date(), outcome: dto.action },
    });

    // The author is told either way — a review that quietly vanishes is worse
    // than one that's removed with a reason.
    await this.notifications
      .create({
        userId: review.authorId,
        type: 'review',
        title: dto.action === 'publish' ? 'Your review is now live' : 'Your review was removed',
        message: dto.note?.trim() || (dto.action === 'publish' ? 'Thanks for sharing it.' : 'It did not meet our review guidelines.'),
        link: '/activity',
      })
      .catch(() => undefined);

    void admin;
    return { id: updated.id, status: updated.status };
  }

  /* -------------------------------- helpers -------------------------------- */

  private stageFromStatus(status: string): string {
    return (
      {
        pending: 'Applied',
        reviewing: 'Screened',
        shortlisted: 'Shortlisted',
        interviewing: 'Interviewed',
        offered: 'Received an offer',
        hired: 'Hired',
        rejected: 'Not selected',
        withdrawn: 'Withdrew',
      }[status] ?? 'Applied'
    );
  }

  private categoryAverages(rows: { categoryRatings: Prisma.JsonValue }[]) {
    const keys = ['communication', 'clarity', 'respect', 'timeliness'] as const;
    const out: Record<string, number | null> = {};
    for (const k of keys) {
      const values = rows
        .map((r) => (r.categoryRatings as Record<string, unknown> | null)?.[k])
        .filter((v): v is number => typeof v === 'number');
      // Null when nobody rated this category — not a zero.
      out[k] = values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null;
    }
    return out;
  }

  private async companyNames(ids: string[]): Promise<Map<string, string>> {
    const profiles = await this.prisma.employerProfile.findMany({
      where: { userId: { in: [...new Set(ids)] } },
      select: { userId: true, companyName: true },
    });
    return new Map(profiles.map((p) => [p.userId, p.companyName?.trim() || 'An employer']));
  }
}
