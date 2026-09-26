import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScorecardRecommendation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

/** The scale. Kept here rather than in the column so it can change freely. */
const MIN_SCORE = 1;
const MAX_SCORE = 5;

/** Which recommendations count as advancing — matches the fairness module. */
const ADVANCING = new Set<ScorecardRecommendation>([
  ScorecardRecommendation.STRONG_YES,
  ScorecardRecommendation.YES,
]);

function displayName(user: User): string {
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email
  );
}

export interface ScorecardInput {
  ratings?: Array<{ criterion: string; score: number }>;
  recommendation?: ScorecardRecommendation | null;
  notes?: string | null;
  /** False saves a draft; true is the reviewer committing to it. */
  submit?: boolean;
}

/**
 * Interview scorecards, one per reviewer.
 *
 * Two things make these worth structuring rather than leaving as free text.
 * A panel only earns its cost if disagreement survives, which needs a row per
 * reviewer. And scoring everyone against the same named criteria is what lets
 * the fairness module say anything meaningful about interview outcomes — a
 * paragraph of prose cannot be checked for adverse impact.
 */
@Injectable()
export class ScorecardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /* -------------------------------- criteria ------------------------------- */

  async listCriteria(user: User, includeArchived = false) {
    const context = await this.companyContext.requireForUser(user.id);
    return this.prisma.scorecardCriterion.findMany({
      where: {
        companyId: context.companyId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
  }

  async addCriterion(user: User, label: string, position?: number) {
    const context = await this.companyContext.requireForUser(user.id);
    const clean = label.trim().slice(0, 60);
    if (!clean) throw new BadRequestException('A criterion needs a name.');

    // Un-archives rather than colliding: re-adding something retired should
    // bring it back with its history, not fail on the unique index.
    return this.prisma.scorecardCriterion.upsert({
      where: { companyId_label: { companyId: context.companyId, label: clean } },
      create: { companyId: context.companyId, label: clean, position: position ?? 0 },
      update: { archivedAt: null, ...(position !== undefined ? { position } : {}) },
    });
  }

  /** Retires a criterion. Existing ratings keep their label and their meaning. */
  async archiveCriterion(user: User, id: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const criterion = await this.prisma.scorecardCriterion.findUnique({ where: { id } });
    if (!criterion || criterion.companyId !== context.companyId) {
      throw new NotFoundException('Criterion not found');
    }
    await this.prisma.scorecardCriterion.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { id };
  }

  /* ------------------------------- scorecards ------------------------------ */

  /** Every reviewer's card for an interview, with the panel's spread. */
  async listForInterview(user: User, interviewId: string) {
    await this.requireCompanyInterview(user, interviewId);
    const cards = await this.prisma.scorecard.findMany({
      where: { interviewId },
      include: { ratings: true },
      orderBy: { createdAt: 'asc' },
    });

    const submitted = cards.filter((c) => c.submittedAt);
    const advancing = submitted.filter(
      (c) => c.recommendation && ADVANCING.has(c.recommendation),
    ).length;

    return {
      scorecards: cards.map((c) => ({
        id: c.id,
        reviewerId: c.reviewerId,
        reviewerName: c.reviewerName,
        recommendation: c.recommendation,
        notes: c.notes,
        submittedAt: c.submittedAt,
        mine: c.reviewerId === user.id,
        ratings: c.ratings.map((r) => ({ criterion: r.criterion, score: r.score })),
      })),
      /**
       * Deliberately not an average recommendation. Three "yes" and one
       * "strong no" is a disagreement worth reading, and a single blended
       * number is exactly how that gets buried.
       */
      summary: {
        submitted: submitted.length,
        advancing,
        dissenting: submitted.length - advancing,
        /** Null until someone has actually scored something. */
        meanScore: this.meanScore(submitted.flatMap((c) => c.ratings.map((r) => r.score))),
      },
    };
  }

  /**
   * Saves the caller's own scorecard.
   *
   * Upserted on (interview, reviewer) so a reviewer edits their own card and
   * can never touch a colleague's — the property the old single-blob field
   * could not offer.
   */
  async save(user: User, interviewId: string, input: ScorecardInput) {
    await this.requireCompanyInterview(user, interviewId);

    const ratings = (input.ratings ?? []).map((r) => ({
      criterion: r.criterion.trim().slice(0, 60),
      score: r.score,
    }));
    for (const r of ratings) {
      if (!Number.isInteger(r.score) || r.score < MIN_SCORE || r.score > MAX_SCORE) {
        throw new BadRequestException(
          `Scores must be whole numbers from ${MIN_SCORE} to ${MAX_SCORE}.`,
        );
      }
      if (!r.criterion) throw new BadRequestException('Every rating needs a criterion.');
    }

    // A submitted card must actually say something; a draft need not.
    if (input.submit && !input.recommendation) {
      throw new BadRequestException('Choose a recommendation before submitting.');
    }

    const card = await this.prisma.scorecard.upsert({
      where: { interviewId_reviewerId: { interviewId, reviewerId: user.id } },
      create: {
        interviewId,
        reviewerId: user.id,
        reviewerName: displayName(user),
        recommendation: input.recommendation ?? null,
        notes: input.notes?.trim() || null,
        submittedAt: input.submit ? new Date() : null,
      },
      update: {
        recommendation: input.recommendation ?? null,
        notes: input.notes?.trim() || null,
        // Re-saving a submitted card keeps it submitted; a draft stays a draft
        // until someone deliberately submits.
        ...(input.submit ? { submittedAt: new Date() } : {}),
      },
    });

    // Replaced wholesale: a criterion the reviewer removed should disappear
    // rather than linger at its old score.
    await this.prisma.$transaction([
      this.prisma.scorecardRating.deleteMany({ where: { scorecardId: card.id } }),
      ...(ratings.length
        ? [
            this.prisma.scorecardRating.createMany({
              data: ratings.map((r) => ({ scorecardId: card.id, ...r })),
            }),
          ]
        : []),
    ]);

    return { id: card.id, submittedAt: card.submittedAt };
  }

  /* -------------------------------- helpers -------------------------------- */

  private meanScore(scores: number[]): number | null {
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  /**
   * The interview must belong to the caller's company.
   *
   * Interviews are keyed to the employer who created them, so this checks
   * against every member — a colleague standing in on a panel is normal.
   */
  private async requireCompanyInterview(user: User, interviewId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, employerId: true },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (!context.memberUserIds.includes(interview.employerId)) {
      throw new ForbiddenException('That interview belongs to another company.');
    }
    return interview;
  }
}
