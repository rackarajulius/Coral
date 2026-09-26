import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DAY_MS = 86_400_000;

/** How many days before the deadline we warn. Two nudges, not a stream. */
const WARN_DAYS = [7, 1];

/**
 * The single definition of "this job is live".
 *
 * Was temporarily ['active', 'published'] while the admin panel wrote its own
 * vocabulary. That's normalised now, so this is one value again — kept as a
 * shared constant so the next divergence has one place to be fixed.
 */
export const LIVE_JOB_STATUSES = ['active'];

@Injectable()
export class JobLifecycleService {
  private readonly logger = new Logger(JobLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Warns employers before a job's deadline passes.
   *
   * Runs before the public list starts hiding expired jobs, so a deadline
   * arriving is never the first an employer hears of it — they can extend it
   * or let it close deliberately.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_8AM, { name: 'job-deadline-warning' })
  async warnExpiringJobs(): Promise<void> {
    const now = new Date();
    let sent = 0;

    for (const days of WARN_DAYS) {
      // Jobs whose deadline falls on the target day, not merely "within N days"
      // — otherwise the 7-day warning fires again every day for a week.
      const from = new Date(now.getTime() + (days - 1) * DAY_MS);
      const to = new Date(now.getTime() + days * DAY_MS);

      const jobs = await this.prisma.job.findMany({
        where: {
          status: { in: LIVE_JOB_STATUSES },
          applicationDeadline: { gte: from, lt: to },
        },
        select: { id: true, title: true, postedById: true, applicationsCount: true },
      });

      for (const job of jobs) {
        const link = `/employers/jobs/${job.id}/edit`;
        // The cron is idempotent per job per window, so a re-run after a
        // failure doesn't notify twice.
        const already = await this.prisma.notification.findFirst({
          where: {
            userId: job.postedById,
            link,
            type: 'job_expiring',
            createdAt: { gte: new Date(now.getTime() - DAY_MS) },
          },
          select: { id: true },
        });
        if (already) continue;

        await this.notifications
          .create({
            userId: job.postedById,
            type: 'job_expiring',
            title:
              days === 1
                ? `"${job.title}" closes tomorrow`
                : `"${job.title}" closes in ${days} days`,
            message:
              job.applicationsCount > 0
                ? `${job.applicationsCount} application${job.applicationsCount === 1 ? '' : 's'} so far. Extend the deadline or let it close.`
                : 'No applications yet. Extending the deadline or widening the role usually helps.',
            link,
          })
          .catch(() => undefined);
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`Sent ${sent} job deadline warning(s)`);
  }

  /**
   * Moves jobs past their deadline to `archived`.
   *
   * Archived, never deleted. Deleting a job cascade-deletes every application
   * to it, which would erase candidates' own application history and destroy
   * the verified-interaction link that makes their reviews trustworthy. A job
   * post is a record of a hiring round, not a cache entry — and at ~2KB a row
   * there is nothing meaningful to reclaim anyway.
   *
   * Deliberately waits a full day past the deadline so the "has closed" notice
   * above always fires first, whatever order the crons run in.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_10AM, { name: 'job-archive-expired' })
  async archiveExpiredJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - DAY_MS);
    try {
      const { count } = await this.prisma.job.updateMany({
        where: {
          status: { in: LIVE_JOB_STATUSES },
          applicationDeadline: { not: null, lt: cutoff },
        },
        data: { status: 'archived' },
      });
      if (count > 0) this.logger.log(`Archived ${count} job(s) past their deadline`);
    } catch (err) {
      this.logger.error(`Archiving expired jobs failed: ${(err as Error).message}`);
    }
  }

  /**
   * Tells employers the day after a job stops accepting applications.
   *
   * Without this, a job silently disappears from search and the employer has
   * no idea why applications stopped.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_8AM, { name: 'job-expired-notice' })
  async noticeExpiredJobs(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - DAY_MS);

    const jobs = await this.prisma.job.findMany({
      where: {
        status: { in: LIVE_JOB_STATUSES },
        applicationDeadline: { gte: from, lt: now },
      },
      select: { id: true, title: true, postedById: true, applicationsCount: true },
    });

    for (const job of jobs) {
      const link = `/employers/jobs/${job.id}/edit`;
      const already = await this.prisma.notification.findFirst({
        where: { userId: job.postedById, link, type: 'job_expired', createdAt: { gte: from } },
        select: { id: true },
      });
      if (already) continue;

      await this.notifications
        .create({
          userId: job.postedById,
          type: 'job_expired',
          title: `"${job.title}" has closed`,
          message: `Its deadline passed, so it no longer appears in search and can't receive applications. ${job.applicationsCount} received in total. Set a new deadline to reopen it.`,
          link,
        })
        .catch(() => undefined);
    }
  }
}
