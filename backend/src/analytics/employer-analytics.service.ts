import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';
import { CHANNEL_CAVEAT, classify, type Channel } from './traffic-source';
import { GEO_CAVEATS, regionFromTimezone } from './geo';

const DAY_MS = 86_400_000;

/** Current statuses that imply an application is in interview or later. */
const CURRENT_INTERVIEW_STATES = ['interviewing', 'interview', 'offered', 'hired'];

export interface Kpi {
  id: string;
  label: string;
  /** Null when there is nothing to measure — the UI shows "—", never a zero. */
  value: number | null;
  unit?: 'count' | 'days' | 'percent';
  /** % change vs the previous window of equal length; null without a baseline. */
  delta: number | null;
  definition: string;
}

@Injectable()
export class EmployerAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /* -------------------------------- helpers ------------------------------- */

  private window(rangeDays: number) {
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * DAY_MS);
    const prevStart = new Date(start.getTime() - rangeDays * DAY_MS);
    return { start, end, prevStart };
  }

  /**
   * Percent change, or null when there's no baseline.
   *
   * Returning null rather than 100% for "0 → n" matters: a first-ever
   * application is not a 100% improvement, and showing one would invent a
   * trend out of a single data point.
   */
  private delta(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /* ------------------------------- overview ------------------------------- */

  async overview(user: User, rangeDays: number) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end, prevStart } = this.window(rangeDays);
    const jobIds = (
      await this.prisma.job.findMany({ where: { postedById: { in: memberIds } }, select: { id: true } })
    ).map((j) => j.id);

    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, createdAt: true },
    });

    const [daily, prevDaily, apps, prevApps, followersBeforeStart, followsInRange] = await Promise.all([
      this.prisma.employerMetricDaily.findMany({
        where: { employerId: { in: memberIds }, day: { gte: start, lte: end } },
        orderBy: { day: 'asc' },
      }),
      this.prisma.employerMetricDaily.aggregate({
        where: { employerId: { in: memberIds }, day: { gte: prevStart, lt: start } },
        _sum: { profileViews: true, jobViews: true, applyClicks: true },
      }),
      this.prisma.application.findMany({
        where: { jobId: { in: jobIds }, appliedAt: { gte: start, lte: end } },
        select: { status: true, appliedAt: true, updatedAt: true },
      }),
      this.prisma.application.count({
        where: { jobId: { in: jobIds }, appliedAt: { gte: prevStart, lt: start } },
      }),
      // Followers already carried by the start of the window — the baseline the
      // in-range series accumulates on top of, so day one isn't drawn as zero.
      profile
        ? this.prisma.companyFollow.count({
            where: { companyId: profile.id, createdAt: { lt: start } },
          })
        : Promise.resolve(0),
      // Only follows inside the window are loaded; the baseline above covers
      // everything older, so this stays bounded however large the audience.
      profile
        ? this.prisma.companyFollow.findMany({
            where: { companyId: profile.id, createdAt: { gte: start, lte: end } },
            select: { createdAt: true },
          })
        : Promise.resolve([] as { createdAt: Date }[]),
    ]);

    // CompanyFollow.createdAt records when each follow happened, so a real
    // cumulative series is derivable from existing data — no capture needed.
    const followersTrend = this.cumulativeByDay(
      followsInRange.map((f) => f.createdAt),
      start,
      end,
      followersBeforeStart,
    );
    const followers = followersTrend.length
      ? followersTrend[followersTrend.length - 1].count
      : followersBeforeStart;

    const sum = (k: 'profileViews' | 'jobViews' | 'applyClicks') =>
      daily.reduce((a, d) => a + d[k], 0);

    const interviews = apps.filter((a) => CURRENT_INTERVIEW_STATES.includes(a.status)).length;
    const hires = apps.filter((a) => a.status === 'hired').length;

    // Time to hire: appliedAt → the change that set 'hired'. updatedAt is the
    // last change of any kind, so this is an upper bound, not an exact figure —
    // flagged as approximate rather than presented as precise.
    const hired = apps.filter((a) => a.status === 'hired');
    const timeToHire = hired.length
      ? Math.round(
          hired.reduce((a, h) => a + (h.updatedAt.getTime() - h.appliedAt.getTime()), 0) /
            hired.length /
            DAY_MS,
        )
      : null;

    const kpis: Kpi[] = [
      {
        id: 'profileViews',
        label: 'Profile Views',
        value: daily.length ? sum('profileViews') : null,
        unit: 'count',
        delta: this.delta(sum('profileViews'), prevDaily._sum.profileViews ?? 0),
        definition: 'Visits to your company profile. Counted since tracking began.',
      },
      {
        id: 'jobViews',
        label: 'Job Views',
        value: daily.length ? sum('jobViews') : null,
        unit: 'count',
        delta: this.delta(sum('jobViews'), prevDaily._sum.jobViews ?? 0),
        definition: 'Views of your job posts, excluding your own visits.',
      },
      {
        id: 'followers',
        label: 'Followers',
        value: followers,
        unit: 'count',
        // Growth of the total across this window, so the delta describes the
        // number shown rather than a differently-scoped quantity.
        delta: this.delta(followers, followersBeforeStart),
        definition: 'People following your company. Running total, including before this period.',
      },
      {
        id: 'applications',
        label: 'Applications',
        value: apps.length,
        unit: 'count',
        delta: this.delta(apps.length, prevApps),
        definition: 'Applications submitted in this period.',
      },
      {
        id: 'interviews',
        label: 'Interview stage',
        value: interviews,
        unit: 'count',
        delta: null,
        definition: 'Applications currently in interviewing, offered, or hired status. Earlier interviews followed by rejection are not recorded as history.',
      },
      {
        id: 'hires',
        label: 'Hires',
        value: hires,
        unit: 'count',
        delta: null,
        definition: 'Applications marked hired in this period.',
      },
      {
        id: 'timeToHire',
        label: 'Time to Hire',
        value: timeToHire,
        unit: 'days',
        delta: null,
        definition:
          'Average days from applying to being marked hired. Approximate: measured to the last status change.',
      },
    ];

    return {
      range: { start, end, days: rangeDays },
      /** When capture began — charts must not imply history before this. */
      trackingSince: daily[0]?.day ?? null,
      profileCreatedAt: profile?.createdAt ?? null,
      kpis,
      trend: daily.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        profileViews: d.profileViews,
        jobViews: d.jobViews,
        applyClicks: d.applyClicks,
        uniqueVisitors: d.uniqueVisitors,
      })),
      /** Applications per day, from appliedAt — available for all history. */
      applicationsTrend: this.bucketByDay(apps.map((a) => a.appliedAt), start, end),
      /** Running follower total per day, from CompanyFollow.createdAt. */
      followersTrend,
    };
  }

  /**
   * Running total per day: the count carried in at `baseline`, plus everything
   * that happened up to and including each day.
   *
   * Distinct from bucketByDay, which reports per-day activity. A follower count
   * is cumulative — plotting daily additions would make a steadily growing
   * audience look flat.
   */
  private cumulativeByDay(dates: Date[], start: Date, end: Date, baseline: number) {
    const added = new Map<string, number>();
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      added.set(key, (added.get(key) ?? 0) + 1);
    }
    const out: { day: string; count: number }[] = [];
    let running = baseline;
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const key = new Date(t).toISOString().slice(0, 10);
      running += added.get(key) ?? 0;
      out.push({ day: key, count: running });
    }
    return out;
  }

  private bucketByDay(dates: Date[], start: Date, end: Date) {
    const counts = new Map<string, number>();
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const out: { day: string; count: number }[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const key = new Date(t).toISOString().slice(0, 10);
      out.push({ day: key, count: counts.get(key) ?? 0 });
    }
    return out;
  }

  /* -------------------------------- funnel -------------------------------- */

  /**
   * The hiring funnel.
   *
   * Split into two halves on purpose. `reach` stages come from event capture
   * and only exist from when tracking began; `pipeline` stages come from
   * application records and cover all history. Presenting them as one
   * continuous funnel would imply a conversion rate between two things
   * measured over different periods.
   */
  async funnel(user: User, rangeDays: number, jobId?: string) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end } = this.window(rangeDays);
    if (jobId) {
      const owned = await this.prisma.job.findFirst({
        where: { id: jobId, postedById: { in: memberIds } },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('Job not found');
    }
    const jobIds = jobId
      ? [jobId]
      : (
          await this.prisma.job.findMany({ where: { postedById: { in: memberIds } }, select: { id: true } })
        ).map((j) => j.id);

    const [reachCounts, apps] = await Promise.all([
      jobId
        ? this.prisma.analyticsEvent.groupBy({
            by: ['type'],
            where: { jobId, employerId: { in: memberIds }, occurredAt: { gte: start, lte: end } },
            _count: { _all: true },
          }).then((rows) => Object.fromEntries(rows.map((row) => [row.type, row._count._all])))
        : this.prisma.employerMetricDaily.aggregate({
            where: { employerId: { in: memberIds }, day: { gte: start, lte: end } },
            _sum: { jobViews: true, applyClicks: true, applyStarted: true },
          }).then((result) => ({
            job_view: result._sum.jobViews ?? 0,
            apply_click: result._sum.applyClicks ?? 0,
            apply_started: result._sum.applyStarted ?? 0,
          })),
      this.prisma.application.findMany({
        where: { jobId: { in: jobIds }, appliedAt: { gte: start, lte: end } },
        select: { status: true },
      }),
    ]);

    const reach = [
      { stage: 'Job Views', volume: reachCounts.job_view ?? 0 },
      { stage: 'Apply Clicks', volume: reachCounts.apply_click ?? 0 },
      { stage: 'Application Started', volume: reachCounts.apply_started ?? 0 },
    ];
    // Application stores only its CURRENT status. These counts are a status
    // breakdown, not cumulative milestones: a rejected candidate may once have
    // interviewed, but that history is not stored here.
    const statuses = [
      ['Pending', 'pending'], ['Reviewing', 'reviewing'], ['Shortlisted', 'shortlisted'],
      ['Interviewing', 'interviewing'], ['Interview', 'interview'],
      ['Offered', 'offered'], ['Hired', 'hired'],
      ['Rejected', 'rejected'], ['Withdrawn', 'withdrawn'], ['Flagged', 'flagged'],
    ] as const;
    const pipeline: { stage: string; volume: number; conversionFromPrev: number | null }[] = statuses.map(([stage, status]) => ({
      stage,
      volume: apps.filter((app) => app.status === status).length,
      conversionFromPrev: null as number | null,
    }));
    const known = new Set(statuses.map(([, status]) => status));
    const other = apps.filter((app) => !known.has(app.status as typeof statuses[number][1])).length;
    if (other) pipeline.push({ stage: 'Other', volume: other, conversionFromPrev: null });

    return {
      range: { start, end, days: rangeDays },
      reach: this.withConversion(reach),
      pipeline,
      notes: {
        reach: 'From page tracking, which began recently — earlier activity is not included.',
        applyStarted:
          'Only counted for on-platform applications. Jobs that apply on a company site cannot report this step.',
        pipeline: 'Current application statuses for submissions in this period. Historical stage transitions are not stored, so these are not cumulative conversion rates.',
      },
    };
  }

  /** Adds conversion-from-previous-stage; null on the first stage. */
  private withConversion(stages: { stage: string; volume: number }[]) {
    return stages.map((s, i) => {
      const prev = i > 0 ? stages[i - 1].volume : null;
      return {
        ...s,
        conversionFromPrev:
          prev && prev > 0 ? Math.round((s.volume / prev) * 1000) / 10 : null,
      };
    });
  }

  /* --------------------------------- jobs --------------------------------- */

  async jobs(user: User, rangeDays: number) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end } = this.window(rangeDays);
    const jobs = await this.prisma.job.findMany({
      where: { postedById: { in: memberIds } },
      select: { id: true, title: true, category: true, viewsCount: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (jobs.length === 0) return { range: { start, end, days: rangeDays }, rows: [] };

    const [views, apps] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['jobId'],
        where: {
          jobId: { in: jobs.map((j) => j.id) },
          type: 'job_view',
          occurredAt: { gte: start, lte: end },
        },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: { jobId: { in: jobs.map((j) => j.id) }, appliedAt: { gte: start, lte: end } },
        select: { jobId: true, status: true },
      }),
    ]);

    const viewsByJob = new Map(views.map((v) => [v.jobId, v._count._all]));

    return {
      range: { start, end, days: rangeDays },
      rows: jobs.map((j) => {
        const mine = apps.filter((a) => a.jobId === j.id);
        const periodViews = viewsByJob.get(j.id) ?? 0;
        return {
          id: j.id,
          title: j.title,
          department: j.category,
          status: j.status,
          /** Views in this period, from event capture. */
          views: periodViews,
          /** Lifetime counter, which predates event capture. */
          viewsAllTime: j.viewsCount,
          applications: mine.length,
          interviews: mine.filter((a) => CURRENT_INTERVIEW_STATES.includes(a.status)).length,
          hires: mine.filter((a) => a.status === 'hired').length,
          /** Applications per view. Null when there were no views to convert. */
          conversion: periodViews > 0 ? Math.round((mine.length / periodViews) * 1000) / 10 : null,
        };
      }),
    };
  }

  /**
   * Normalises a job's skills array.
   *
   * Some jobs were saved with every skill in ONE array element, comma-joined
   * ("Customer Service, Active Listening, ..."). Left alone that renders as a
   * single nonsense row and makes the whole tab useless, so split defensively
   * here. This only splits what's already there — it invents nothing.
   */
  private splitSkills(skills: string[]): string[] {
    return skills
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 60);
  }

  /* ----------------------------- traffic source --------------------------- */

  /**
   * Where visitors came from, by channel.
   *
   * Counts SESSIONS, not events: one person arriving from LinkedIn and opening
   * four jobs is one visit from LinkedIn, and counting events would make
   * whichever channel produces browsers look like the biggest channel.
   *
   * Only `page_source` events carry a usable referrer — every other event is
   * recorded from an API request whose Referer header is our own app.
   */
  async sources(user: User, rangeDays: number) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end } = this.window(rangeDays);

    const rows = await this.prisma.analyticsEvent.findMany({
      where: { employerId: { in: memberIds }, type: 'page_source', occurredAt: { gte: start, lte: end } },
      select: { sessionHash: true, source: true, utmSource: true, utmMedium: true, utmCampaign: true },
    });

    if (rows.length === 0) {
      return {
        range: { start, end, days: rangeDays },
        channels: [],
        campaigns: [],
        totalSessions: 0,
        caveat: CHANNEL_CAVEAT,
        note: 'No traffic recorded yet. Sources are collected from when a visitor first lands on one of your pages.',
      };
    }

    // First touch per session: someone who arrives from search and later
    // returns directly is one search visit, not one of each.
    const firstBySession = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = r.sessionHash ?? `anon-${firstBySession.size}`;
      if (!firstBySession.has(key)) firstBySession.set(key, r);
    }
    const sessions = [...firstBySession.values()];

    const byChannel = new Map<Channel, number>();
    const byCampaign = new Map<string, number>();
    for (const s of sessions) {
      const channel = classify({ source: s.source, utmSource: s.utmSource, utmMedium: s.utmMedium });
      byChannel.set(channel, (byChannel.get(channel) ?? 0) + 1);
      if (s.utmCampaign) byCampaign.set(s.utmCampaign, (byCampaign.get(s.utmCampaign) ?? 0) + 1);
    }

    return {
      range: { start, end, days: rangeDays },
      totalSessions: sessions.length,
      channels: [...byChannel.entries()]
        .map(([channel, sessionCount]) => ({
          channel,
          sessions: sessionCount,
          share: Math.round((sessionCount / sessions.length) * 1000) / 10,
        }))
        .sort((a, b) => b.sessions - a.sessions),
      campaigns: [...byCampaign.entries()]
        .map(([campaign, sessionCount]) => ({ campaign, sessions: sessionCount }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10),
      caveat: CHANNEL_CAVEAT,
      note: null as string | null,
    };
  }

  /**
   * Where visitors are, by region.
   *
   * Reports which source it used, because the two differ in accuracy by a lot:
   * `country` is resolved at the CDN edge and is reliable; `timezone` is the
   * visitor's device clock and is only good for a continent. The UI has to be
   * able to say which one the numbers came from.
   */
  async geo(user: User, rangeDays: number) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end } = this.window(rangeDays);

    const rows = await this.prisma.analyticsEvent.findMany({
      where: { employerId: { in: memberIds }, type: 'page_source', occurredAt: { gte: start, lte: end } },
      select: { sessionHash: true, country: true, timezone: true },
    });

    // One row per session — the same person opening four jobs is one visitor.
    const bySession = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = r.sessionHash ?? `anon-${bySession.size}`;
      if (!bySession.has(key)) bySession.set(key, r);
    }
    const sessions = [...bySession.values()];

    const withCountry = sessions.filter((s) => s.country);
    // Prefer country only when enough sessions carry one; a country chart built
    // from three of two hundred visits is worse than an honest region chart.
    const useCountry = withCountry.length >= Math.max(5, sessions.length * 0.5);

    const counts = new Map<string, number>();
    for (const s of sessions) {
      const key = useCountry ? (s.country ?? 'Unknown') : regionFromTimezone(s.timezone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const total = sessions.length;
    return {
      range: { start, end, days: rangeDays },
      /** 'country' = edge-resolved, 'timezone' = approximate, null = no data. */
      basis: total === 0 ? null : useCountry ? ('country' as const) : ('timezone' as const),
      totalSessions: total,
      places: [...counts.entries()]
        .map(([place, count]) => ({
          place,
          sessions: count,
          share: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 8),
      caveat: total === 0 ? null : useCountry ? GEO_CAVEATS.country : GEO_CAVEATS.timezone,
      note:
        total === 0
          ? 'No visits recorded yet. Location is collected when a visitor first lands on one of your pages.'
          : null,
    };
  }

  /**
   * Employer-brand KPIs.
   *
   * Four tiles, not the seven the page used to show. The three that are gone —
   * Video Engagement, Career Page CTR and Visibility Score — had no data source
   * and no definition: nothing tracks video plays, nothing distinguishes a
   * "career page" click from any other, and a visibility score is a composite
   * of inputs that don't exist. They were fixed numbers with deltas attached.
   */
  async brand(user: User, rangeDays: number) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const { start, end, prevStart } = this.window(rangeDays);

    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const [daily, prevDaily, followsInRange, followsPrev, posts, prevPosts] = await Promise.all([
      this.prisma.employerMetricDaily.aggregate({
        where: { employerId: { in: memberIds }, day: { gte: start, lte: end } },
        _sum: { profileViews: true, uniqueVisitors: true },
      }),
      this.prisma.employerMetricDaily.aggregate({
        where: { employerId: { in: memberIds }, day: { gte: prevStart, lt: start } },
        _sum: { profileViews: true, uniqueVisitors: true },
      }),
      profile
        ? this.prisma.companyFollow.count({
            where: { companyId: profile.id, createdAt: { gte: start, lte: end } },
          })
        : Promise.resolve(0),
      profile
        ? this.prisma.companyFollow.count({
            where: { companyId: profile.id, createdAt: { gte: prevStart, lt: start } },
          })
        : Promise.resolve(0),
      // Engagement on posts this employer wrote, in this window.
      this.prisma.post.aggregate({
        where: { authorId: { in: memberIds }, createdAt: { gte: start, lte: end } },
        _sum: { likesCount: true, commentsCount: true },
      }),
      this.prisma.post.aggregate({
        where: { authorId: { in: memberIds }, createdAt: { gte: prevStart, lt: start } },
        _sum: { likesCount: true, commentsCount: true },
      }),
    ]);

    const hasTracking = (daily._sum.profileViews ?? 0) > 0 || (daily._sum.uniqueVisitors ?? 0) > 0;
    const engagement = (posts._sum.likesCount ?? 0) + (posts._sum.commentsCount ?? 0);
    const prevEngagement = (prevPosts._sum.likesCount ?? 0) + (prevPosts._sum.commentsCount ?? 0);

    const kpis: Kpi[] = [
      {
        id: 'profileViews',
        label: 'Profile Views',
        // Null rather than 0 before any rollup exists: "not measured yet" and
        // "measured zero" are different claims.
        value: hasTracking ? (daily._sum.profileViews ?? 0) : null,
        unit: 'count',
        delta: this.delta(daily._sum.profileViews ?? 0, prevDaily._sum.profileViews ?? 0),
        definition: 'Visits to your company profile, since tracking began.',
      },
      {
        id: 'uniqueVisitors',
        label: 'Unique Visitors',
        value: hasTracking ? (daily._sum.uniqueVisitors ?? 0) : null,
        unit: 'count',
        delta: this.delta(daily._sum.uniqueVisitors ?? 0, prevDaily._sum.uniqueVisitors ?? 0),
        definition:
          'Distinct visitors per day, summed. Someone visiting on two days counts twice — we deliberately cannot follow a person across days.',
      },
      {
        id: 'followerGrowth',
        label: 'New Followers',
        value: followsInRange,
        unit: 'count',
        delta: this.delta(followsInRange, followsPrev),
        definition: 'People who followed your company in this period.',
      },
      {
        id: 'contentEngagement',
        label: 'Content Engagement',
        value: engagement,
        unit: 'count',
        delta: this.delta(engagement, prevEngagement),
        definition: 'Likes and comments on posts you published in this period.',
      },
    ];

    return {
      range: { start, end, days: rangeDays },
      kpis,
      topContent: await this.topContent(user, start, end),
    };
  }

  /**
   * The employer's most-engaged posts in this window.
   *
   * Ranked by likes + comments + bookmarks. There is no view count: post
   * impressions aren't tracked, and the old panel showed "18,420 views" beside
   * every post — a number with no source at all. Engagement is what we actually
   * record, so engagement is what's shown.
   */
  private async topContent(user: User, start: Date, end: Date) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const posts = await this.prisma.post.findMany({
      where: { authorId: { in: memberIds }, createdAt: { gte: start, lte: end } },
      select: {
        id: true,
        content: true,
        postType: true,
        likesCount: true,
        commentsCount: true,
        bookmarksCount: true,
        createdAt: true,
      },
      take: 100,
    });

    return posts
      .map((p) => ({
        id: p.id,
        // Posts have no title — the first line stands in, trimmed rather than
        // padded so the UI never shows an invented headline.
        excerpt: p.content.split('\n')[0].trim().slice(0, 120) || 'Untitled post',
        postType: p.postType,
        likes: p.likesCount,
        comments: p.commentsCount,
        bookmarks: p.bookmarksCount,
        engagement: p.likesCount + p.commentsCount + p.bookmarksCount,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => b.engagement - a.engagement || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }

  /* -------------------------------- talent -------------------------------- */

  /**
   * Skill demand vs supply on this platform.
   *
   * Demand = how many live jobs ask for a skill. Supply = how many open
   * job-seeker profiles list it. Both are counts of real records; neither is a
   * market index, and the response says so.
   */
  async talent(user: User) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const myJobs = await this.prisma.job.findMany({
      where: { postedById: { in: memberIds }, status: 'active' },
      select: { skills: true },
    });
    const mySkills = [...new Set(myJobs.flatMap((j) => this.splitSkills(j.skills)))].slice(0, 40);
    if (mySkills.length === 0) {
      return { skills: [], note: 'Add skills to your job posts to see demand and supply.' };
    }

    // Deliberately NOT filtered with `hasSome`: that matches the raw stored
    // array, which for comma-joined rows never matches a split skill — so the
    // query would silently return 0 and look like a real absence. Scanning a
    // capped set and matching in memory is slower but honest.
    const [demandJobs, supplyProfiles] = await Promise.all([
      this.prisma.job.findMany({
        where: { status: 'active' },
        select: { skills: true },
        take: 5000,
      }),
      this.prisma.jobSeekerProfile.findMany({
        where: { NOT: { skills: { isEmpty: true } } },
        select: { skills: true },
        take: 5000,
      }),
    ]);

    const count = (rows: { skills: string[] }[], skill: string) =>
      rows.filter((r) =>
        this.splitSkills(r.skills).some((s) => s.toLowerCase() === skill.toLowerCase()),
      ).length;

    return {
      skills: mySkills
        .map((skill) => ({
          skill,
          demand: count(demandJobs, skill),
          supply: count(supplyProfiles, skill),
        }))
        .sort((a, b) => b.demand - a.demand)
        .slice(0, 12),
      note: 'Counts of live job posts and job-seeker profiles on this platform — not a market-wide index.',
    };
  }
}
