import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { UpsertDemographicReportDto } from './dto/demographic-report.dto';

/**
 * Smallest group we will report a number for. Below this, a rate identifies
 * individuals — "1 of 2 candidates in this group advanced" is a disclosure, not
 * a statistic.
 */
export const MIN_GROUP_SIZE = 10;

/**
 * Below this, a group's rate is too noisy to act on. The four-fifths rule is
 * conventionally applied to samples of this order or larger; smaller groups
 * swing wildly on one person's result.
 */
export const RELIABLE_GROUP_SIZE = 30;

/** Recommendations that move a candidate forward — the "selection" event. */
const ADVANCING = new Set(['strong_yes', 'yes']);

export interface GroupStat {
  value: string;
  n: number;
  advanced: number;
  advancedRate: number;
  meanScore: number;
  /** Rate ÷ the best-performing group's rate. Below 0.8 flags adverse impact. */
  impactRatio: number | null;
  /** True when n is large enough for the ratio to mean something. */
  reliable: boolean;
}

/** One scored screen joined to its candidate's self-report. */
interface ImpactRow {
  score: number;
  advanced: boolean;
  ethnicity: string | null;
  gender: string | null;
  ageBand: string | null;
  disability: string | null;
  veteran: string | null;
}

export interface DimensionReport {
  dimension: string;
  /** Groups meeting MIN_GROUP_SIZE. */
  groups: GroupStat[];
  /** People excluded because their group was too small to report. */
  suppressed: number;
  /** Groups under 0.8 impact ratio, among the reliable ones. */
  flagged: string[];
}

@Injectable()
export class FairnessService {
  constructor(private readonly prisma: PrismaService) {}

  /* --------------------------- candidate's own --------------------------- */

  async getMine(user: User) {
    const row = await this.prisma.demographicSelfReport.findUnique({
      where: { userId: user.id },
      select: {
        ethnicity: true, gender: true, ageBand: true, disability: true, veteran: true,
        updatedAt: true,
      },
    });
    return row ?? null;
  }

  async upsertMine(user: User, dto: UpsertDemographicReportDto) {
    const data = {
      ethnicity: dto.ethnicity ?? null,
      gender: dto.gender ?? null,
      ageBand: dto.ageBand ?? null,
      disability: dto.disability ?? null,
      veteran: dto.veteran ?? null,
    };
    const row = await this.prisma.demographicSelfReport.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      select: {
        ethnicity: true, gender: true, ageBand: true, disability: true, veteran: true,
        updatedAt: true,
      },
    });
    return row;
  }

  async deleteMine(user: User) {
    await this.prisma.demographicSelfReport.deleteMany({ where: { userId: user.id } });
    return { deleted: true };
  }

  /* ------------------------------ aggregate ------------------------------ */

  /**
   * Adverse-impact report for the AI screening scorer.
   *
   * Returns only aggregates, and only for groups of at least MIN_GROUP_SIZE.
   * There is deliberately no way to ask this service about one person.
   */
  async adverseImpact(opts: { jobId?: string } = {}) {
    const screens = await this.prisma.aiScreen.findMany({
      where: {
        status: 'completed',
        overallScore: { not: null },
        ...(opts.jobId ? { jobId: opts.jobId } : {}),
      },
      select: { candidateId: true, overallScore: true, recommendation: true },
    });

    if (screens.length === 0) {
      return this.emptyReport('No screening has been scored yet.');
    }

    const reports = await this.prisma.demographicSelfReport.findMany({
      where: { userId: { in: [...new Set(screens.map((s) => s.candidateId))] } },
      select: {
        userId: true,
        ethnicity: true, gender: true, ageBand: true, disability: true, veteran: true,
      },
    });
    const byUser = new Map(reports.map((r) => [r.userId, r]));

    // One row per scored screen that has a self-report to join to.
    const rows = screens
      .map((s) => {
        const d = byUser.get(s.candidateId);
        if (!d) return null;
        return {
          score: s.overallScore ?? 0,
          advanced: ADVANCING.has(s.recommendation ?? ''),
          ethnicity: d.ethnicity,
          gender: d.gender,
          ageBand: d.ageBand,
          disability: d.disability,
          veteran: d.veteran,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const coverage = screens.length > 0 ? rows.length / screens.length : 0;

    if (rows.length === 0) {
      return this.emptyReport(
        'No scored candidate has provided a self-report, so nothing can be compared.',
        { scoredScreens: screens.length, withSelfReport: 0, coverage: 0 },
      );
    }

    const dimensions: DimensionReport[] = [
      this.analyze(rows, 'ethnicity', (r) => r.ethnicity),
      this.analyze(rows, 'gender', (r) => r.gender),
      this.analyze(rows, 'ageBand', (r) => r.ageBand),
      this.analyze(rows, 'disability', (r) => r.disability),
      this.analyze(rows, 'veteran', (r) => r.veteran),
    ];

    const anyReliable = dimensions.some((d) => d.groups.some((g) => g.reliable));

    return {
      available: true as const,
      note: anyReliable
        ? null
        : `Every group is under ${RELIABLE_GROUP_SIZE} people. These numbers are indicative only — one person's result moves them substantially.`,
      totals: {
        scoredScreens: screens.length,
        withSelfReport: rows.length,
        coverage: Math.round(coverage * 100) / 100,
      },
      minGroupSize: MIN_GROUP_SIZE,
      reliableGroupSize: RELIABLE_GROUP_SIZE,
      dimensions,
    };
  }

  /**
   * Who job recommendations reach, by self-reported group.
   *
   * Recommending jobs is delivering employment ads, and ad delivery can skew by
   * group with no one choosing a target — the pattern regulators found at
   * Meta. The matching rules read no protected attribute, but a skew can still
   * arrive through proxies (which skills people list, where they live), so it
   * is measured rather than assumed away.
   *
   * "Reached" = sent at least one recommendation in the window; the mean is
   * recommendations per person. Same suppression and four-fifths ratio as the
   * screening report. A low ratio is a prompt to look, not a verdict: groups
   * can differ in the skills and preferences the rules correctly read.
   */
  async recommendationReach(opts: { days?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 90, 7), 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const reports = await this.prisma.demographicSelfReport.findMany({
      where: { user: { role: 'JOB_SEEKER', status: 'ACTIVE' } },
      select: {
        userId: true,
        ethnicity: true, gender: true, ageBand: true, disability: true, veteran: true,
      },
    });
    if (reports.length === 0) {
      return {
        ...this.emptyReport('No job seeker has provided a self-report, so nothing can be compared.'),
        windowDays: days,
      };
    }

    const delivered = await this.prisma.jobRecommendation.groupBy({
      by: ['userId'],
      where: { userId: { in: reports.map((r) => r.userId) }, notifiedAt: { gte: since } },
      _count: { _all: true },
    });
    const perUser = new Map(delivered.map((d) => [d.userId, d._count._all]));

    const rows: ImpactRow[] = reports.map((r) => ({
      score: perUser.get(r.userId) ?? 0,
      advanced: (perUser.get(r.userId) ?? 0) > 0,
      ethnicity: r.ethnicity,
      gender: r.gender,
      ageBand: r.ageBand,
      disability: r.disability,
      veteran: r.veteran,
    }));

    const dimensions: DimensionReport[] = [
      this.analyze(rows, 'ethnicity', (r) => r.ethnicity),
      this.analyze(rows, 'gender', (r) => r.gender),
      this.analyze(rows, 'ageBand', (r) => r.ageBand),
      this.analyze(rows, 'disability', (r) => r.disability),
      this.analyze(rows, 'veteran', (r) => r.veteran),
    ];
    const anyReliable = dimensions.some((d) => d.groups.some((g) => g.reliable));

    return {
      available: true as const,
      windowDays: days,
      /** How to read the shared field names in this report. */
      measures: {
        advancedRate: 'share of the group sent at least one recommendation',
        meanScore: 'recommendations sent per person',
      },
      note: anyReliable
        ? null
        : `Every group is under ${RELIABLE_GROUP_SIZE} people. These numbers are indicative only.`,
      totals: {
        seekersWithSelfReport: reports.length,
        reached: rows.filter((r) => r.advanced).length,
      },
      minGroupSize: MIN_GROUP_SIZE,
      reliableGroupSize: RELIABLE_GROUP_SIZE,
      dimensions,
    };
  }

  private emptyReport(
    reason: string,
    totals: { scoredScreens: number; withSelfReport: number; coverage: number } = {
      scoredScreens: 0,
      withSelfReport: 0,
      coverage: 0,
    },
  ) {
    return {
      available: false as const,
      note: reason,
      totals,
      minGroupSize: MIN_GROUP_SIZE,
      reliableGroupSize: RELIABLE_GROUP_SIZE,
      dimensions: [] as DimensionReport[],
    };
  }

  /**
   * One dimension's group rates plus the four-fifths ratio against the
   * best-performing group. "prefer_not_to_say" is excluded from comparison —
   * it isn't a group, it's a declined answer.
   */
  private analyze(
    rows: ImpactRow[],
    dimension: string,
    pick: (r: ImpactRow) => string | null,
  ): DimensionReport {
    const buckets = new Map<string, { score: number; advanced: boolean }[]>();
    for (const r of rows) {
      const value = pick(r);
      if (!value || value === 'prefer_not_to_say') continue;
      const list = buckets.get(value) ?? [];
      list.push({ score: r.score, advanced: r.advanced });
      buckets.set(value, list);
    }

    let suppressed = 0;
    const stats: GroupStat[] = [];
    for (const [value, list] of buckets) {
      if (list.length < MIN_GROUP_SIZE) {
        suppressed += list.length;
        continue;
      }
      const advanced = list.filter((x) => x.advanced).length;
      stats.push({
        value,
        n: list.length,
        advanced,
        advancedRate: advanced / list.length,
        meanScore: Math.round((list.reduce((a, b) => a + b.score, 0) / list.length) * 10) / 10,
        impactRatio: null,
        reliable: list.length >= RELIABLE_GROUP_SIZE,
      });
    }

    const best = Math.max(0, ...stats.map((s) => s.advancedRate));
    for (const s of stats) {
      s.impactRatio = best > 0 ? Math.round((s.advancedRate / best) * 100) / 100 : null;
    }
    stats.sort((a, b) => b.advancedRate - a.advancedRate);

    return {
      dimension,
      groups: stats,
      suppressed,
      // Only flag where the sample can support the claim; a 0.6 ratio on 11
      // people is noise, and reporting it as a finding devalues real ones.
      flagged: stats
        .filter((s) => s.reliable && s.impactRatio !== null && s.impactRatio < 0.8)
        .map((s) => s.value),
    };
  }
}
