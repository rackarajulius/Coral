import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailPreferencesService } from '../notifications/email-preferences.service';
import { readSeekerPrefs } from '../notifications/seeker-preferences';
import { EmailService } from '../services/email/email.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { skillSet, titleTokens } from '../common/job-text';
import { RECOMMEND_MIN_SCORE, scoreJobForProfile } from './job-match.rules';
import { JOB_MATCH_SELECT, PROFILE_MATCH_SELECT, companyOf, toMatchJob, toMatchProfile } from './match-inputs';

const DAY_MS = 86_400_000;

/** Seekers told about a newly live job. The best matches, not everyone who clears the bar. */
export const ORGANIC_REACH = 50;
/** Profiles read per fan-out before scoring. */
const CANDIDATE_SCAN_LIMIT = 5000;
/** Newly live jobs handled per sweep, so one busy morning cannot stall the pass. */
const SWEEP_BATCH = 25;
/** A job that went live longer ago than this is not "new" any more. */
const FRESH_JOB_DAYS = 14;

/** At most one digest per person per day — the agreed cap. */
const DIGEST_INTERVAL_MS = DAY_MS;
/** Jobs per digest. */
export const DIGEST_SIZE = 5;
/** Paid items per digest. The cap is on the digest, so paying never adds one. */
const MAX_PROMOTED_IN_DIGEST = 2;
/** A queued recommendation older than this is stale news; it is not sent. */
const QUEUE_FRESH_DAYS = 7;
/** People handled per digest pass. */
const DIGEST_BATCH = 500;

export interface FanOutOptions {
  limit: number;
  source: 'publish' | 'boost';
  promoted: boolean;
}

/**
 * Tells matching seekers about jobs.
 *
 * Two halves. **Fan-out** decides who should hear about a job and queues a
 * JobRecommendation for each; it runs when a job goes live, and again when a
 * boost buys more reach. **The digest** delivers the queue — never more than
 * one message a day, never more than five jobs — as an in-app notification and,
 * only for people who opted in, an email.
 *
 * Queueing and delivering are separate so that a job published at 9am and
 * another at 11am reach someone as one message, not two, and so paying for a
 * boost can widen who hears about a job without raising how often anyone is
 * contacted.
 */
@Injectable()
export class JobFanoutService {
  private readonly logger = new Logger(JobFanoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly notifications: NotificationsService,
    private readonly emailPrefs: EmailPreferencesService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /* --------------------------------- fan-out -------------------------------- */

  /**
   * Picks up jobs that went live since the last pass.
   *
   * A sweep rather than a hook in the publish path: publishing has four entry
   * points (create, edit, status change, duplicate), and a hook missed in one
   * of them would fail silently. `fannedOutAt` records that a job was handled
   * even when nobody matched, so it is not re-read every pass.
   */
  @ExclusiveCron(CronExpression.EVERY_10_MINUTES, { name: 'job-recommendation-fanout' })
  async sweepNewJobs(): Promise<void> {
    const jobs = await this.prisma.job.findMany({
      where: {
        status: { in: LIVE_JOB_STATUSES },
        fannedOutAt: null,
        OR: [
          { publishedAt: { gte: new Date(Date.now() - FRESH_JOB_DAYS * DAY_MS) } },
          { publishedAt: null, createdAt: { gte: new Date(Date.now() - FRESH_JOB_DAYS * DAY_MS) } },
        ],
      },
      select: { id: true },
      orderBy: { publishedAt: 'asc' },
      take: SWEEP_BATCH,
    });
    for (const job of jobs) {
      try {
        const queued = await this.fanOut(job.id, { limit: ORGANIC_REACH, source: 'publish', promoted: false });
        await this.prisma.job.update({ where: { id: job.id }, data: { fannedOutAt: new Date() } });
        if (queued > 0) this.logger.log(`Job ${job.id.slice(0, 8)}: queued for ${queued} seekers`);
      } catch (err) {
        // Left unmarked, so the next pass tries again.
        this.logger.error(`Fan-out for ${job.id} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /**
   * Queues the job for the best-matching seekers who have not had it yet.
   *
   * Everyone scores against the same RECOMMEND_MIN_SCORE; `limit` only decides
   * how far down the list of qualifying people it goes. Ties go to people who
   * said they are looking, then to recently active profiles.
   *
   * @returns how many were queued.
   */
  async fanOut(jobId: string, opts: FanOutOptions): Promise<number> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { ...JOB_MATCH_SELECT, status: true },
    });
    if (!job || !LIVE_JOB_STATUSES.includes(job.status)) return 0;

    const prefilter = this.prefilter(job.title, job.skills);
    if (!prefilter) return 0;

    const [team, already, applied] = await Promise.all([
      this.companyContext.memberUserIds(job.postedById),
      this.prisma.jobRecommendation.findMany({ where: { jobId }, select: { userId: true } }),
      this.prisma.application.findMany({ where: { jobId }, select: { applicantId: true } }),
    ]);
    const exclude = new Set([...team, ...already.map((r) => r.userId), ...applied.map((a) => a.applicantId)]);

    const profiles = await this.prisma.jobSeekerProfile.findMany({
      where: {
        user: { role: UserRole.JOB_SEEKER, status: UserStatus.ACTIVE },
        OR: prefilter,
      },
      select: PROFILE_MATCH_SELECT,
      take: CANDIDATE_SCAN_LIMIT,
    });

    const matchJob = toMatchJob(job);
    const picked = profiles
      .filter((p) => !exclude.has(p.userId))
      .map((p) => ({ p, result: scoreJobForProfile(matchJob, toMatchProfile(p)) }))
      .filter((x): x is { p: typeof x.p; result: NonNullable<typeof x.result> } =>
        !!x.result && x.result.score >= RECOMMEND_MIN_SCORE,
      )
      .sort(
        (a, b) =>
          b.result.score - a.result.score ||
          Number(b.p.openToWork) - Number(a.p.openToWork) ||
          b.p.updatedAt.getTime() - a.p.updatedAt.getTime(),
      )
      .slice(0, opts.limit);

    if (picked.length === 0) return 0;

    const { count } = await this.prisma.jobRecommendation.createMany({
      data: picked.map(({ p, result }) => ({
        jobId,
        userId: p.userId,
        score: result.score,
        reasons: result.reasons,
        source: opts.source,
        promoted: opts.promoted,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /**
   * A cheap database narrowing before scoring: anyone who lists one of the
   * job's skills, or whose title or headline contains a word of the job title.
   * Scoring decides; this only avoids reading every profile.
   */
  private prefilter(title: string, skills: string[]): Prisma.JobSeekerProfileWhereInput[] | null {
    const skillList = [...skillSet(skills)];
    const words = [...titleTokens(title)].filter((w) => w.length >= 3);
    const or: Prisma.JobSeekerProfileWhereInput[] = [];
    if (skillList.length) or.push({ skillsNormalized: { hasSome: skillList } });
    for (const w of words) {
      or.push({ currentTitle: { contains: w, mode: 'insensitive' } });
      or.push({ headline: { contains: w, mode: 'insensitive' } });
    }
    return or.length ? or : null;
  }

  /* --------------------------------- digest --------------------------------- */

  /**
   * Delivers queued recommendations, at most once a day per person.
   *
   * Hourly, so a job published in the morning reaches someone whose day
   * window opens in the afternoon without waiting for tomorrow's run.
   */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'job-recommendation-digest' })
  async sendDigests(): Promise<void> {
    const now = new Date();
    const due = await this.dueDigestUsers();
    let sent = 0;
    for (const userId of due) {
      try {
        if (await this.digestFor(userId, now)) sent++;
      } catch (err) {
        this.logger.error(`Digest for ${userId.slice(0, 8)} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (sent) this.logger.log(`Recommendation digests sent: ${sent}`);
  }

  /**
   * People with something queued whose daily window is open.
   *
   * The cooldown is applied in the query, not after it: picking "anyone with
   * something queued" and skipping those digested in the last day meant the
   * same cooled-down people filled every batch, and past DIGEST_BATCH of them
   * nobody else would ever be reached. Same conditions as queuedWhere().
   */
  private async dueDigestUsers(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT DISTINCT r.user_id
        FROM job_recommendations r
        JOIN jobs j ON j.id = r.job_id
       WHERE r.notified_at IS NULL
         AND r.dismissed_at IS NULL
         AND r.opened_at IS NULL
         AND r.created_at >= now() - (${QUEUE_FRESH_DAYS}::integer * interval '1 day')
         AND j.status = ANY(${LIVE_JOB_STATUSES}::text[])
         AND NOT EXISTS (
               SELECT 1 FROM job_recommendations n
                WHERE n.user_id = r.user_id
                  AND n.notified_at > now() - (${DIGEST_INTERVAL_MS}::integer * interval '1 millisecond'))
       LIMIT ${DIGEST_BATCH}::integer`;
    return rows.map((r) => r.user_id);
  }

  private queuedWhere(now: Date): Prisma.JobRecommendationWhereInput {
    return {
      notifiedAt: null,
      dismissedAt: null,
      openedAt: null,
      createdAt: { gte: new Date(now.getTime() - QUEUE_FRESH_DAYS * DAY_MS) },
      job: { status: { in: LIVE_JOB_STATUSES } },
    };
  }

  /** @returns true when something was delivered. */
  async digestFor(userId: string, now = new Date()): Promise<boolean> {
    const last = await this.prisma.jobRecommendation.findFirst({
      where: { userId, notifiedAt: { not: null } },
      orderBy: { notifiedAt: 'desc' },
      select: { notifiedAt: true },
    });
    if (last?.notifiedAt && now.getTime() - last.notifiedAt.getTime() < DIGEST_INTERVAL_MS) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, status: true, role: true,
        jobSeekerProfile: { select: { notificationSettings: true } },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE || user.role !== UserRole.JOB_SEEKER) return false;

    const prefs = readSeekerPrefs(user.jobSeekerProfile?.notificationSettings);
    const wantEmail = prefs.emailJobRecommendations && this.emailPrefs.emailConfigured();
    // Both off: leave the queue alone. It ages out; the feed still shows matches.
    if (!prefs.pushJobRecommendations && !wantEmail) return false;

    const [queued, applied] = await Promise.all([
      this.prisma.jobRecommendation.findMany({
        where: { ...this.queuedWhere(now), userId },
        select: { id: true, jobId: true, score: true, promoted: true, job: { select: JOB_MATCH_SELECT } },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.application.findMany({ where: { applicantId: userId }, select: { jobId: true } }),
    ]);
    const appliedIds = new Set(applied.map((a) => a.jobId));

    const chosen: typeof queued = [];
    let promotedCount = 0;
    for (const row of queued) {
      if (appliedIds.has(row.jobId)) continue;
      if (row.promoted) {
        if (promotedCount >= MAX_PROMOTED_IN_DIGEST) continue;
        promotedCount++;
      }
      chosen.push(row);
      if (chosen.length >= DIGEST_SIZE) break;
    }
    if (chosen.length === 0) return false;

    const lines = chosen.map((r) => {
      const company = companyOf(r.job).name;
      return `${r.job.title} · ${company}${r.promoted ? ' · Promoted' : ''}`;
    });
    const plural = chosen.length === 1 ? 'job' : 'jobs';
    let delivered = false;

    if (prefs.pushJobRecommendations) {
      const note = await this.notifications.create({
        userId,
        type: 'job_recommendation',
        title: `${chosen.length} ${plural} picked for you`,
        message: lines.join('\n'),
        link: `/jobs?job=${chosen[0].jobId}&src=rec`,
      });
      delivered = delivered || note !== null;
    }

    if (wantEmail) {
      try {
        const base = (this.config.get<string>('FRONTEND_URL') || '').replace(/\/+$/, '');
        await this.email.sendPlainText({
          to: user.email,
          subject: `${chosen.length} ${plural} picked for you on Coral`,
          message: [
            'Hi,',
            '',
            `Based on the skills and preferences on your profile, these ${plural} look like a fit:`,
            '',
            ...chosen.map((r, i) => `${i + 1}. ${lines[i]}\n   ${base}/jobs?job=${r.jobId}&src=rec`),
            '',
            'Promoted jobs are paid for by the employer; they are only sent when they match you as well as any other.',
            '',
            '- Coral',
            this.emailPrefs.footer(userId, 'job_recommendations'),
          ].join('\n'),
        });
        delivered = true;
      } catch (err) {
        this.logger.error(`Recommendation email to ${userId.slice(0, 8)} failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!delivered) return false;
    await this.prisma.jobRecommendation.updateMany({
      where: { id: { in: chosen.map((r) => r.id) } },
      data: { notifiedAt: now },
    });
    return true;
  }

  /* -------------------------------- retention ------------------------------- */

  /**
   * Drops recommendations that were queued and never went anywhere.
   *
   * Delivered, opened and dismissed rows stay: they are the employer's reach
   * figures and the seeker's "not interested" list.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_4AM, { name: 'job-recommendation-retention' })
  async pruneStale(): Promise<void> {
    const { count } = await this.prisma.jobRecommendation.deleteMany({
      where: {
        notifiedAt: null,
        openedAt: null,
        dismissedAt: null,
        createdAt: { lt: new Date(Date.now() - 30 * DAY_MS) },
      },
    });
    if (count) this.logger.log(`Pruned ${count} undelivered recommendations`);
  }
}
