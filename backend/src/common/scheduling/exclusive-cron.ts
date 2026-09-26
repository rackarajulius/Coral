import { Cron, CronOptions } from '@nestjs/schedule';
import { CronTime } from 'cron';

/**
 * Scheduled jobs that run once per slot, however many servers are up.
 *
 * `@Cron` alone runs on every server: two instances means every reminder,
 * digest and expiry notice goes out twice. `@ExclusiveCron` is `@Cron` plus a
 * database lease (CronLeaseService) — each server's timer still fires, but only
 * the one that wins the lease does the work. Use it for every scheduled job;
 * `npm run verify:scheduled-jobs` fails if a bare `@Cron` appears.
 */
export interface ExclusiveCronOptions {
  /** Required: it is the lease key, and what admins see. */
  name: string;
  /** IANA zone for the schedule. Default: the server's zone. */
  timeZone?: string;
  disabled?: boolean;
  /**
   * Minimum time between two starts. Default: half the job's period, so a
   * second server whose timer fires a few seconds late finds the slot taken
   * — and a daily job cannot run twice in one day.
   */
  minGapMs?: number;
  /**
   * How long a run holds the job before another server may take it — only
   * matters if the holder dies mid-run. Default: the period less five
   * seconds, between 55 seconds and an hour.
   */
  leaseMs?: number;
}

export interface RegisteredJob {
  name: string;
  cronTime: string;
  periodMs: number;
  minGapMs: number;
  leaseMs: number;
  /** The class that declares the job, to find its instance for a manual run. */
  target: abstract new (...args: never[]) => unknown;
  methodName: string;
  /** The undecorated method. */
  original: (...args: unknown[]) => unknown;
}

/** Every @ExclusiveCron in the app, by name. Filled as classes are loaded. */
export const CRON_REGISTRY = new Map<string, RegisteredJob>();

type Runner = (job: RegisteredJob, work: () => Promise<unknown>) => Promise<void>;
let runner: Runner | null = null;

/** Set by CronLeaseService when the app starts; cleared when it stops. */
export function setScheduledRunner(next: Runner | null): void {
  runner = next;
}

/** Time between two consecutive fires of a cron expression. */
export function periodOf(cronTime: string): number {
  const [a, b] = new CronTime(cronTime).sendAt(2);
  return b.toMillis() - a.toMillis();
}

export function ExclusiveCron(cronTime: string, options: ExclusiveCronOptions): MethodDecorator {
  return (target, key, descriptor: PropertyDescriptor) => {
    const { minGapMs, leaseMs, timeZone, disabled } = options;
    const periodMs = periodOf(cronTime);
    const original = descriptor.value as (...args: unknown[]) => unknown;

    const job: RegisteredJob = {
      name: options.name,
      cronTime,
      periodMs,
      minGapMs: minGapMs ?? Math.floor(periodMs / 2),
      leaseMs: leaseMs ?? Math.min(Math.max(periodMs - 5_000, 55_000), 60 * 60_000),
      target: target.constructor as RegisteredJob['target'],
      methodName: String(key),
      original,
    };
    // Two jobs sharing a name would share a lease and silently block each other.
    if (CRON_REGISTRY.has(job.name)) {
      throw new Error(`Two scheduled jobs are named "${job.name}"; names must be unique.`);
    }
    CRON_REGISTRY.set(job.name, job);

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const work = async () => original.apply(this, args);
      // No runner means no Nest app around this call (a script constructing the
      // service by hand): behave like the plain method.
      if (!runner) return work();
      await runner(job, work);
    };

    // Registered on the wrapper, so the scheduler calls through the lease.
    // waitForCompletion: a slow run is not overlapped by its own next tick.
    const cronOptions: CronOptions = {
      name: options.name,
      waitForCompletion: true,
      ...(disabled !== undefined ? { disabled } : {}),
      ...(timeZone ? { timeZone } : {}),
    };
    Cron(cronTime, cronOptions)(target, key, descriptor);
    return descriptor;
  };
}
