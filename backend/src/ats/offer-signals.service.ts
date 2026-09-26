import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OfferStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { User } from '../common/types/user.types';
import { normalizePayPeriod, roleSimilarity, skillSet, titleTokens } from '../common/job-text';
import { MIN_OFFERS_FOR_USUAL, NotChecked, OfferFacts, OfferSignal, SignalTone, offerSignals } from './offer-signal.rules';

/** Other companies' live posts read for the market comparison. */
const MARKET_SCAN = 5000;
/** A median of fewer posts than this is one company's opinion. */
const MIN_MARKET_SAMPLES = 3;
/** Decided offers needed before an overall acceptance rate is shown. */
export const OUTCOMES_MIN_TOTAL = 10;
/** And per group (with / without a signal) before comparing them. */
export const OUTCOMES_MIN_GROUP = 10;
const OUTCOMES_WINDOW_DAYS = 365;
/** Signals about the wait after sending — not facts about the offer as sent. */
const AFTER_SEND = new Set(['awaiting_answer', 'awaiting_answer_recent', 'deadline_close']);

/** Values being typed into an unsent offer, checked before they are saved. */
export interface OfferPreview {
  salaryAmount?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: string | null;
  startDate?: string | null;
  expiresAt?: string | null;
}

/**
 * Gathers the facts for offer signals and keeps the record they are judged by.
 * The rules themselves are in offer-signal.rules.ts.
 */
@Injectable()
export class OfferSignalsService {
  private readonly logger = new Logger(OfferSignalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Signals for one application's offer — the saved one, or the values in
   * `preview` while it is still being written.
   */
  async forApplication(user: User, applicationId: string, preview?: OfferPreview) {
    const context = await this.companyContext.requireForUser(user.id);
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        appliedAt: true,
        applicantId: true,
        job: {
          select: {
            id: true, postedById: true, title: true, skills: true,
            salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true,
          },
        },
        offer: true,
      },
    });
    // Another company's application reads as missing.
    if (!application || !context.memberUserIds.includes(application.job.postedById)) {
      throw new NotFoundException('Application not found');
    }
    const facts = await this.facts(context, application, preview);
    return { ...offerSignals(facts), generatedAt: facts.now.toISOString() };
  }

  /**
   * Freezes the signals onto an offer as it is sent. Never throws — failing to
   * record this must not stop an offer going out.
   */
  async snapshot(offerId: string): Promise<void> {
    try {
      const offer = await this.prisma.offer.findUnique({
        where: { id: offerId },
        select: {
          companyId: true,
          application: {
            select: {
              id: true, appliedAt: true, applicantId: true,
              job: { select: { id: true, postedById: true, title: true, skills: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true } },
              offer: true,
            },
          },
        },
      });
      if (!offer) return;
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: offer.companyId, status: { in: ['ACTIVE', 'SUSPENDED', 'REMOVED'] } },
        select: { userId: true },
      });
      const facts = await this.facts(
        { companyId: offer.companyId, memberUserIds: members.map((m) => m.userId) },
        offer.application,
      );
      // The waiting-for-an-answer signals describe what happens after sending;
      // every sent offer would carry them, so they say nothing about outcomes.
      const signals = offerSignals(facts).signals.filter((s) => !AFTER_SEND.has(s.id));
      await this.prisma.offer.update({
        where: { id: offerId },
        data: { signalsAtSend: signals.map((s) => ({ id: s.id, tone: s.tone })) as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.warn(`Could not record offer signals for ${offerId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * What happened to offers, by the signals they went out with.
   *
   * The learning half of offer signals, and silent until it has something to
   * say: an overall rate needs OUTCOMES_MIN_TOTAL decided offers, and a
   * with/without comparison needs OUTCOMES_MIN_GROUP on each side. Below that,
   * one person's decision would read as a pattern.
   *
   * Expired offers count as not accepted; withdrawn ones are excluded — the
   * company decided those, not the candidate.
   */
  async outcomes(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    const since = new Date(Date.now() - OUTCOMES_WINDOW_DAYS * 86_400_000);
    const decided = await this.prisma.offer.findMany({
      where: {
        companyId: context.companyId,
        status: { in: [OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED] },
        sentAt: { gte: since },
      },
      select: { status: true, signalsAtSend: true },
    });
    const accepted = (rows: typeof decided) => rows.filter((r) => r.status === OfferStatus.ACCEPTED).length;
    const rate = (n: number, of: number) => Math.round((n / of) * 100);
    const idsOf = (r: (typeof decided)[number]) =>
      new Set(((r.signalsAtSend ?? []) as { id: string }[]).map((s) => s.id));

    const withSnapshot = decided.filter((r) => Array.isArray(r.signalsAtSend));
    const seen = new Map<string, SignalTone>();
    for (const r of withSnapshot) {
      for (const s of (r.signalsAtSend as { id: string; tone: SignalTone }[])) seen.set(s.id, s.tone);
    }

    const bySignal = [...seen].map(([id, tone]) => {
      const present = withSnapshot.filter((r) => idsOf(r).has(id));
      const absent = withSnapshot.filter((r) => !idsOf(r).has(id));
      const enough = present.length >= OUTCOMES_MIN_GROUP && absent.length >= OUTCOMES_MIN_GROUP;
      return {
        id,
        tone,
        withSignal: { decided: present.length, acceptanceRate: enough ? rate(accepted(present), present.length) : null },
        without: { decided: absent.length, acceptanceRate: enough ? rate(accepted(absent), absent.length) : null },
      };
    });

    return {
      windowDays: OUTCOMES_WINDOW_DAYS,
      decided: decided.length,
      accepted: accepted(decided),
      acceptanceRate: decided.length >= OUTCOMES_MIN_TOTAL ? rate(accepted(decided), decided.length) : null,
      minTotal: OUTCOMES_MIN_TOTAL,
      minGroup: OUTCOMES_MIN_GROUP,
      bySignal: bySignal.sort((a, b) => b.withSignal.decided - a.withSignal.decided),
      note:
        decided.length < OUTCOMES_MIN_TOTAL
          ? `Rates appear after ${OUTCOMES_MIN_TOTAL} decided offers — ${decided.length} so far.`
          : null,
    };
  }

  /* ---------------------------------- facts --------------------------------- */

  private async facts(
    context: { companyId: string; memberUserIds: string[] },
    application: {
      id: string;
      appliedAt: Date;
      applicantId: string;
      job: {
        id: string; title: string; skills: string[];
        salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; salaryPeriod: string | null;
      };
      offer: {
        status: OfferStatus; salaryAmount: number | null; salaryCurrency: string; salaryPeriod: string | null;
        startDate: Date | null; expiresAt: Date | null; sentAt: Date | null; respondedAt: Date | null;
      } | null;
    },
    preview?: OfferPreview,
  ): Promise<OfferFacts> {
    const now = new Date();
    const saved = application.offer;
    // A preview describes an unsent offer: its values replace the saved draft's wholesale,
    // so clearing a field on screen clears it here too.
    const draft = preview
      ? {
          status: 'DRAFT',
          amountMinor: preview.salaryAmount ?? null,
          currency: (preview.salaryCurrency || saved?.salaryCurrency || 'cad').toLowerCase(),
          period: preview.salaryPeriod ?? null,
          startDate: preview.startDate ? new Date(preview.startDate) : null,
          expiresAt: preview.expiresAt ? new Date(preview.expiresAt) : null,
          sentAt: null,
          respondedAt: null,
        }
      : {
          status: saved?.status ?? 'DRAFT',
          amountMinor: saved?.salaryAmount ?? null,
          currency: (saved?.salaryCurrency || 'cad').toLowerCase(),
          period: saved?.salaryPeriod ?? null,
          startDate: saved?.startDate ?? null,
          expiresAt: saved?.expiresAt ?? null,
          sentAt: saved?.sentAt ?? null,
          respondedAt: saved?.respondedAt ?? null,
        };

    const [market, profile, usual, interviews, messages] = await Promise.all([
      this.market(context.memberUserIds, application.job, draft.currency, normalizePayPeriod(draft.period)),
      this.prisma.jobSeekerProfile.findUnique({
        where: { userId: application.applicantId },
        select: { salaryExpectation: true, privacySettings: true },
      }),
      this.usualDaysToOffer(context.companyId, application.id),
      this.prisma.interview.groupBy({
        by: ['status'],
        where: { candidateId: application.applicantId, employerId: { in: context.memberUserIds } },
        _count: { _all: true },
      }),
      this.lastMessages(context.memberUserIds, application.applicantId),
    ]);

    const privacy = (profile?.privacySettings ?? {}) as { showSalaryExpectations?: boolean };
    const shared = privacy.showSalaryExpectations === true;
    const countOf = (...statuses: string[]) =>
      interviews.filter((i) => statuses.includes(i.status)).reduce((n, i) => n + i._count._all, 0);

    return {
      now,
      ...draft,
      appliedAt: application.appliedAt,
      job: application.job,
      market,
      expectation: { shared, text: shared ? profile?.salaryExpectation ?? null : null },
      usualDaysToOffer: usual,
      interviews: { attended: countOf('confirmed', 'completed'), declined: countOf('declined') },
      messages,
    };
  }

  /** Median posted pay for similar live roles at other companies, in this currency and period. */
  private async market(
    memberIds: string[],
    job: { id: string; title: string; skills: string[] },
    currency: string,
    period: 'yearly' | 'monthly' | 'hourly' | null,
  ): Promise<{ median: number | null; samples: number }> {
    if (!period) return { median: null, samples: 0 };
    const others = await this.prisma.job.findMany({
      where: {
        status: { in: LIVE_JOB_STATUSES },
        postedById: { notIn: memberIds },
        id: { not: job.id },
        OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
      },
      select: { title: true, skills: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true },
      take: MARKET_SCAN,
    });
    const title = titleTokens(job.title);
    const skills = skillSet(job.skills);
    const midpoints = others
      .filter(
        (o) =>
          o.salaryCurrency.toLowerCase() === currency &&
          normalizePayPeriod(o.salaryPeriod) === period &&
          roleSimilarity(title, skills, titleTokens(o.title), skillSet(o.skills)) !== null,
      )
      .map((o) =>
        o.salaryMin != null && o.salaryMax != null ? (o.salaryMin + o.salaryMax) / 2 : (o.salaryMin ?? o.salaryMax)!,
      )
      .sort((a, b) => a - b);
    if (midpoints.length < MIN_MARKET_SAMPLES) return { median: null, samples: midpoints.length };
    const mid = Math.floor(midpoints.length / 2);
    const median = midpoints.length % 2 ? midpoints[mid] : (midpoints[mid - 1] + midpoints[mid]) / 2;
    return { median: Math.round(median), samples: midpoints.length };
  }

  /** This company's median days from application to a sent offer, once it has enough history. */
  private async usualDaysToOffer(companyId: string, excludeApplicationId: string) {
    const rows = await this.prisma.offer.findMany({
      where: { companyId, sentAt: { not: null }, applicationId: { not: excludeApplicationId } },
      select: { sentAt: true, application: { select: { appliedAt: true } } },
      take: 500,
    });
    const spans = rows
      .map((r) => Math.round((r.sentAt!.getTime() - r.application.appliedAt.getTime()) / 86_400_000))
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);
    if (spans.length < MIN_OFFERS_FOR_USUAL) return null;
    const mid = Math.floor(spans.length / 2);
    const median = spans.length % 2 ? spans[mid] : Math.round((spans[mid - 1] + spans[mid]) / 2);
    return { median, offers: spans.length };
  }

  /** The latest message each way between this company and the candidate. */
  private async lastMessages(memberIds: string[], candidateId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { candidateId, employerId: { in: memberIds } },
      select: { id: true },
    });
    if (conversations.length === 0) return { lastFromCandidate: null, lastFromCompany: null };
    const ids = conversations.map((c) => c.id);
    const [theirs, ours] = await Promise.all([
      this.prisma.message.findFirst({
        where: { conversationId: { in: ids }, senderId: candidateId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.message.findFirst({
        where: { conversationId: { in: ids }, senderId: { in: memberIds } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    return { lastFromCandidate: theirs?.createdAt ?? null, lastFromCompany: ours?.createdAt ?? null };
  }
}

export type { OfferSignal, NotChecked };
