import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { BillingService } from '../billing/billing.service';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { User } from '../common/types/user.types';
import { JobFanoutService } from './job-fanout.service';

const DAY_MS = 86_400_000;

/** How long a boost runs. */
export const BOOST_DAYS = 14;
/** Seekers queued when a boost starts, beyond those the job already reached. */
export const BOOST_REACH = 250;
/** When the follow-up check runs. */
export const SECOND_WAVE_AFTER_DAYS = 3;
/** Fewer applications than this since the boost started, and the follow-up wave goes out. */
export const SLOW_APPLICATIONS = 5;
export const SECOND_WAVE_REACH = 150;

/**
 * Paid reach for a job.
 *
 * What a boost buys, and all it buys:
 * - a wider fan-out now (the next BOOST_REACH best-matching seekers),
 * - a follow-up wave after SECOND_WAVE_AFTER_DAYS if applications are slow,
 * - a labelled "Promoted" slot in the feeds of seekers it already matches.
 *
 * What it can never buy is an audience. There is no parameter anywhere in this
 * service for who should see the job: the same rules and the same minimum
 * score decide that for every job, paid or not. Nor can it raise how often
 * anyone is contacted — the digest cap is per person, and boosted jobs compete
 * for its slots like any other.
 */
@Injectable()
export class JobBoostService {
  private readonly logger = new Logger(JobBoostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly billing: BillingService,
    private readonly fanout: JobFanoutService,
  ) {}

  async start(user: User, jobId: string) {
    const context = await this.companyContext.forUser(user.id);
    const memberIds = context?.memberUserIds ?? [user.id];

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, postedById: true },
    });
    // Someone else's job reads as missing, not forbidden: no probing for ids.
    if (!job || !memberIds.includes(job.postedById)) throw new NotFoundException('Job not found');
    if (!LIVE_JOB_STATUSES.includes(job.status)) {
      throw new BadRequestException('Only a live job can be boosted. Publish it first.');
    }

    const running = await this.prisma.jobBoost.findFirst({
      where: { jobId, status: 'active', endsAt: { gt: new Date() } },
      select: { endsAt: true },
    });
    if (running) {
      throw new ConflictException(
        `This job is already boosted until ${running.endsAt.toISOString().slice(0, 10)}.`,
      );
    }

    const allowance = await this.billing.boostAllowance(user.id);
    const over = allowance.limit !== null && allowance.used >= allowance.limit;
    if (over && allowance.enforced) {
      throw new ForbiddenException(
        allowance.limit === 0
          ? 'Your plan does not include boosts.'
          : `Your plan's ${allowance.limit} boosts for this period are used.`,
      );
    }

    const now = new Date();
    const boost = await this.prisma.jobBoost.create({
      data: {
        jobId,
        companyId: context?.companyId ?? null,
        createdById: user.id,
        startsAt: now,
        endsAt: new Date(now.getTime() + BOOST_DAYS * DAY_MS),
      },
    });

    // Any organic fan-out still pending would otherwise run after this and
    // find everyone already queued; mark it done — the boost's wave covers it.
    await this.prisma.job.updateMany({ where: { id: jobId, fannedOutAt: null }, data: { fannedOutAt: now } });

    const reached = await this.fanout.fanOut(jobId, { limit: BOOST_REACH, source: 'boost', promoted: true });
    this.logger.log(`Boost ${boost.id.slice(0, 8)} on ${jobId.slice(0, 8)}: queued ${reached}`);

    return {
      boost: this.present(boost),
      queued: reached,
      allowance: { ...allowance, used: allowance.used + 1, overAllowance: over },
    };
  }

  /** Stops a boost early. The allowance it used is not returned. */
  async end(user: User, boostId: string) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const boost = await this.prisma.jobBoost.findUnique({
      where: { id: boostId },
      include: { job: { select: { postedById: true } } },
    });
    if (!boost || !memberIds.includes(boost.job.postedById)) throw new NotFoundException('Boost not found');
    if (boost.status !== 'active') return this.present(boost);
    const ended = await this.prisma.jobBoost.update({
      where: { id: boostId },
      data: { status: 'ended', endedAt: new Date() },
    });
    return this.present(ended);
  }

  async allowance(user: User) {
    return this.billing.boostAllowance(user.id);
  }

  present(b: {
    id: string; jobId: string; status: string; startsAt: Date; endsAt: Date;
    secondWaveAt: Date | null; endedAt: Date | null;
  }) {
    const live = b.status === 'active' && b.endsAt > new Date();
    return {
      id: b.id,
      jobId: b.jobId,
      status: live ? 'active' : 'ended',
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      secondWaveAt: b.secondWaveAt?.toISOString() ?? null,
      endedAt: b.endedAt?.toISOString() ?? null,
    };
  }

  /* ---------------------------------- crons --------------------------------- */

  /** Closes boosts whose time is up or whose job is no longer live. */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'job-boost-expiry' })
  async expire(): Promise<void> {
    const now = new Date();
    const { count } = await this.prisma.jobBoost.updateMany({
      where: {
        status: 'active',
        OR: [{ endsAt: { lte: now } }, { job: { status: { notIn: LIVE_JOB_STATUSES } } }],
      },
      data: { status: 'ended', endedAt: now },
    });
    if (count) this.logger.log(`Ended ${count} boosts`);
  }

  /**
   * The follow-up wave: after a few days, if applications are still slow,
   * reach the next best-matching seekers. The check runs once per boost;
   * `secondWaveAt` records that it ran, and the rows it wrote (source 'boost')
   * record whether it sent anything.
   */
  @ExclusiveCron(CronExpression.EVERY_6_HOURS, { name: 'job-boost-second-wave' })
  async secondWave(): Promise<void> {
    const due = await this.prisma.jobBoost.findMany({
      where: {
        status: 'active',
        secondWaveAt: null,
        startsAt: { lte: new Date(Date.now() - SECOND_WAVE_AFTER_DAYS * DAY_MS) },
      },
      select: { id: true, jobId: true, startsAt: true },
      take: 50,
    });
    for (const b of due) {
      try {
        const applications = await this.prisma.application.count({
          where: { jobId: b.jobId, appliedAt: { gte: b.startsAt } },
        });
        let queued = 0;
        if (applications < SLOW_APPLICATIONS) {
          queued = await this.fanout.fanOut(b.jobId, { limit: SECOND_WAVE_REACH, source: 'boost', promoted: true });
        }
        await this.prisma.jobBoost.update({ where: { id: b.id }, data: { secondWaveAt: new Date() } });
        if (queued) this.logger.log(`Boost ${b.id.slice(0, 8)} follow-up: queued ${queued}`);
      } catch (err) {
        this.logger.error(`Second wave for boost ${b.id} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}
