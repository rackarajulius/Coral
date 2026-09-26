import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from './automations.service';
import { computeNextRun } from './next-run';
import { definitionFor } from './task-registry';

/** A claim older than this is assumed abandoned — a process died mid-run. */
const STALE_CLAIM_MS = 15 * 60 * 1000;
/** Ceiling per sweep, so one company's tasks cannot starve everyone else's. */
const BATCH = 50;

/**
 * Runs whatever is due.
 *
 * One sweeper rather than a cron job per task: jobs registered at runtime live
 * in process memory, so they disappear on restart and duplicate the moment a
 * second instance starts. Querying `nextRunAt` survives both, and the claim
 * below is what keeps two instances from running the same task twice.
 */
@Injectable()
export class AutomationsScheduler {
  private readonly logger = new Logger(AutomationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: AutomationsService,
    private readonly notifications: NotificationsService,
  ) {}

  @ExclusiveCron(CronExpression.EVERY_30_MINUTES, { name: 'scheduled-tasks-sweep' })
  async sweep(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);

    let due: { id: string; claimedAt: Date | null }[];
    try {
      due = await this.prisma.scheduledTask.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: now },
          OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
        },
        select: { id: true, claimedAt: true },
        orderBy: { nextRunAt: 'asc' },
        take: BATCH,
      });
    } catch (err) {
      this.logger.error(`Could not read due tasks: ${(err as Error).message}`);
      return;
    }

    for (const row of due) {
      // Compare-and-set: whoever flips claimedAt from the value we read wins,
      // and everyone else skips. updateMany returns a count, so no exception
      // handling is needed for the loser.
      const claim = await this.prisma.scheduledTask.updateMany({
        where: { id: row.id, claimedAt: row.claimedAt },
        data: { claimedAt: now },
      });
      if (claim.count === 0) continue;

      await this.runClaimed(row.id);
    }
  }

  private async runClaimed(id: string): Promise<void> {
    const task = await this.prisma.scheduledTask.findUnique({ where: { id } });
    if (!task) return;

    try {
      const outcome = await this.automations.execute(task);

      // Silence is the default: a weekly "nothing to report" is how people
      // learn to ignore a feature, so zero only notifies when asked for.
      if (outcome.count > 0 || task.notifyWhenEmpty) {
        await this.notifications.create({
          userId: task.createdById,
          type: 'system',
          title: outcome.title,
          message: outcome.message,
          link: definitionFor(task.type).link,
        });
      }

      await this.prisma.scheduledTask.update({
        where: { id },
        data: {
          lastRunAt: new Date(),
          lastSummary: outcome.message,
          nextRunAt: computeNextRun(task),
          claimedAt: null,
        },
      });
    } catch (err) {
      this.logger.error(`Task ${id} failed: ${(err as Error).message}`);
      // Still advance the schedule and drop the claim. A task that throws every
      // run would otherwise be retried every sweep forever, and a failing
      // handler must not wedge the queue for everyone else.
      await this.prisma.scheduledTask
        .update({
          where: { id },
          data: {
            lastRunAt: new Date(),
            lastSummary: 'This run failed. It will try again on its next schedule.',
            nextRunAt: computeNextRun(task),
            claimedAt: null,
          },
        })
        .catch(() => undefined);
    }
  }
}
