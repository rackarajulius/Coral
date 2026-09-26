import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { CronTime } from 'cron';
import { randomBytes } from 'crypto';
import { hostname } from 'os';
import { PrismaService } from '../../prisma/prisma.service';
import { CRON_REGISTRY, RegisteredJob, setScheduledRunner } from './exclusive-cron';

export type RunOutcome =
  | { ran: true; status: 'ok' | 'failed'; error: string | null; durationMs: number }
  | { ran: false; reason: 'disabled' | 'not-due' | 'running' | 'claim-failed' };

/**
 * The lease behind @ExclusiveCron.
 *
 * Each job has one row in `cron_leases`. To run, a server flips that row with
 * a single conditional UPDATE — the database decides the winner, so no two
 * servers can both believe they hold it. The conditions:
 *
 * - **not held**: nobody is running it, or the holder's lease ran out (the
 *   holder died mid-run, so the job is not stuck forever);
 * - **not already run for this slot**: the last start is older than the job's
 *   minimum gap. Without this, a server whose timer fired two seconds late
 *   would find the lease already released and run a daily job a second time.
 *
 * Times come from the database clock, never a server's, so servers whose
 * clocks disagree still agree on who is due.
 */
@Injectable()
export class CronLeaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronLeaseService.name);
  /** Which server holds a lease — shown to admins, and checked on release. */
  readonly instanceId = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    setScheduledRunner(async (job, work) => {
      await this.runScheduled(job, work);
    });
    if (!this.enabled()) {
      this.logger.warn('SCHEDULED_JOBS_ENABLED=false: this server will not run scheduled jobs.');
    }
  }

  onModuleDestroy(): void {
    setScheduledRunner(null);
  }

  /**
   * Whether this server takes part. Off lets web servers leave the jobs to a
   * dedicated worker, or a serverless deploy trigger them from outside.
   */
  enabled(): boolean {
    return this.config.get<string>('SCHEDULED_JOBS_ENABLED') !== 'false';
  }

  /** A timer fired. Runs the job only if this server wins the slot. */
  async runScheduled(job: RegisteredJob, work: () => Promise<unknown>): Promise<RunOutcome> {
    if (!this.enabled()) return { ran: false, reason: 'disabled' };
    return this.run(job, work, false);
  }

  /**
   * Runs a job now, for an admin. Skips the minimum gap — someone asked — but
   * never runs alongside a copy that is already going.
   */
  async runNow(name: string): Promise<RunOutcome> {
    const job = CRON_REGISTRY.get(name);
    if (!job) throw new NotFoundException(`No scheduled job named "${name}"`);
    const instance = this.moduleRef.get(job.target as never, { strict: false });
    return this.run(job, async () => job.original.call(instance), true);
  }

  private async run(job: RegisteredJob, work: () => Promise<unknown>, manual: boolean): Promise<RunOutcome> {
    let claimed: number;
    try {
      await this.prisma.$executeRaw`
        INSERT INTO cron_leases (name) VALUES (${job.name}) ON CONFLICT (name) DO NOTHING`;
      claimed = await this.prisma.$executeRaw`
        UPDATE cron_leases
           SET locked_until = now() + (${job.leaseMs}::integer * interval '1 millisecond'),
               locked_by = ${this.instanceId},
               last_started_at = now()
         WHERE name = ${job.name}
           AND (locked_until IS NULL OR locked_until < now())
           AND (${manual}::boolean
                OR last_started_at IS NULL
                OR last_started_at < now() - (${job.minGapMs}::integer * interval '1 millisecond'))`;
    } catch (err) {
      // Running without the lease is how duplicates happen; skipping one slot is the lesser harm.
      this.logger.error(`Could not claim "${job.name}", skipped this run: ${this.message(err)}`);
      return { ran: false, reason: 'claim-failed' };
    }
    if (claimed === 0) return { ran: false, reason: manual ? 'running' : 'not-due' };

    const started = Date.now();
    let status: 'ok' | 'failed' = 'ok';
    let error: string | null = null;
    try {
      await work();
    } catch (err) {
      status = 'failed';
      error = this.message(err).slice(0, 2000);
      this.logger.error(`Scheduled job "${job.name}" failed: ${error}`);
    }
    const durationMs = Date.now() - started;

    try {
      await this.prisma.$executeRaw`
        UPDATE cron_leases
           SET locked_until = NULL,
               locked_by = NULL,
               last_finished_at = now(),
               last_status = ${status},
               last_error = ${error}::text,
               last_duration_ms = ${durationMs}::integer,
               last_ran_by = ${this.instanceId},
               run_count = run_count + 1,
               consecutive_failures = CASE WHEN ${status}::text = 'failed' THEN consecutive_failures + 1 ELSE 0 END
         WHERE name = ${job.name} AND locked_by = ${this.instanceId}`;
    } catch (err) {
      // The lease expires on its own; the only loss is this run's record.
      this.logger.warn(`Could not release "${job.name}": ${this.message(err)}`);
    }
    return { ran: true, status, error, durationMs };
  }

  /** Every registered job with its last run, as the admin pages show them. */
  async status() {
    const rows = await this.prisma.cronLease.findMany();
    const byName = new Map(rows.map((r) => [r.name, r]));
    const now = Date.now();

    return [...CRON_REGISTRY.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((job) => {
        const row = byName.get(job.name);
        const running = !!row?.lockedUntil && row.lockedUntil.getTime() > now;
        // Two missed periods plus slack: a server is up but the job is not running.
        const overdue =
          this.enabled() &&
          !!row?.lastStartedAt &&
          now - row.lastStartedAt.getTime() > 2 * job.periodMs + 5 * 60_000;
        const status = running
          ? 'running'
          : row?.lastStatus === 'failed'
            ? 'failed'
            : overdue
              ? 'overdue'
              : row?.lastStatus === 'ok'
                ? 'completed'
                : 'scheduled';
        let nextRun: string | null = null;
        try {
          nextRun = new CronTime(job.cronTime).sendAt().toISO();
        } catch {
          nextRun = null;
        }
        return {
          name: job.name,
          schedule: job.cronTime,
          status,
          lastRun: row?.lastStartedAt?.toISOString() ?? null,
          lastFinished: row?.lastFinishedAt?.toISOString() ?? null,
          lastDurationMs: row?.lastDurationMs ?? null,
          lastError: row?.lastError ?? null,
          lastRanBy: row?.lastRanBy ?? null,
          heldBy: running ? row?.lockedBy ?? null : null,
          consecutiveFailures: row?.consecutiveFailures ?? 0,
          runCount: row?.runCount ?? 0,
          nextRun,
        };
      });
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
