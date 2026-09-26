// Checks that scheduled jobs run once per slot however many servers are up.
//
//   npm run verify:scheduled-jobs
//
// 1. Static: no bare @Cron left in src (every job must go through the lease).
// 2. Live, against the real database: two CronLeaseService instances — two
//    "servers" — race for one throwaway job. Its lease row is deleted after.
import 'dotenv/config';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CronLeaseService } from '../src/common/scheduling/cron-lease.service';
import { CRON_REGISTRY, RegisteredJob, periodOf } from '../src/common/scheduling/exclusive-cron';

let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

(async () => {
  // 1. Static
  const src = join(__dirname, '..', 'src');
  const bare = walk(src).filter(
    (f) => !f.includes(join('common', 'scheduling')) && /@(Cron|Interval|Timeout)\(/.test(readFileSync(f, 'utf8')),
  );
  check('no bare @Cron/@Interval/@Timeout outside the lease', bare.length === 0, bare);
  const names = walk(src).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/@ExclusiveCron\([^)]*name: '([^']+)'/g)].map((m) => m[1]),
  );
  check(`${names.length} scheduled jobs, all names unique`, new Set(names).size === names.length && names.length > 0);
  check('periods read from cron expressions', periodOf('0 */10 * * * *') === 600_000 && periodOf('0 0 8 * * *') === 86_400_000);

  // 2. Live
  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  const moduleRef = { get: () => ({}) } as any;
  const serverA = new CronLeaseService(prisma, config, moduleRef);
  const serverB = new CronLeaseService(prisma, config, moduleRef);
  const name = `__verify-lease-${Date.now()}`;

  let runs = 0;
  let fail = false;
  class Probe {}
  const job: RegisteredJob = {
    name,
    cronTime: '0 0 8 * * *',
    periodMs: 86_400_000,
    minGapMs: 43_200_000,
    leaseMs: 1_500,
    target: Probe,
    methodName: 'work',
    original: async () => {
      runs++;
      await sleep(400);
      if (fail) throw new Error('boom');
    },
  };
  CRON_REGISTRY.set(name, job);
  const work = () => job.original() as Promise<unknown>;

  try {
    const [a, b] = await Promise.all([serverA.runScheduled(job, work), serverB.runScheduled(job, work)]);
    check('two servers fire at once: exactly one runs', runs === 1 && [a, b].filter((o) => o.ran).length === 1, [a, b]);

    const late = await serverB.runScheduled(job, work);
    check('a timer firing late finds the slot taken (daily job not run twice)', !late.ran && late.reason === 'not-due', late);

    const manual = await serverB.runNow(name);
    check('an admin "run now" runs regardless of the slot', manual.ran === true && runs === 2, manual);

    // A server dies holding the lease.
    await prisma.$executeRaw`UPDATE cron_leases SET locked_until = now() + interval '1.5 seconds', locked_by = 'dead-server' WHERE name = ${name}`;
    const blocked = await serverA.runNow(name);
    check('never runs alongside a copy that is still running', !blocked.ran && blocked.reason === 'running', blocked);
    await sleep(1_700);
    const recovered = await serverA.runNow(name);
    check("a dead server's lease expires and the job runs again", recovered.ran === true, recovered);

    fail = true;
    const failed = await serverA.runNow(name);
    const row1 = await prisma.cronLease.findUnique({ where: { name } });
    check('a failure is recorded with its error, lease released', failed.ran === true && row1?.lastStatus === 'failed' && row1?.lastError === 'boom' && row1?.consecutiveFailures === 1 && row1?.lockedUntil === null, { status: row1?.lastStatus, error: row1?.lastError, failures: row1?.consecutiveFailures });
    fail = false;
    await serverA.runNow(name);
    const row2 = await prisma.cronLease.findUnique({ where: { name } });
    check('a success resets the failure count', row2?.lastStatus === 'ok' && row2?.consecutiveFailures === 0 && row2?.runCount === 5, { runs: row2?.runCount });

    const status = (await serverA.status()).find((s) => s.name === name);
    check('status reports it for the admin page', status?.status === 'completed' && status?.lastRun !== null, status && { status: status.status, lastRanBy: status.lastRanBy });

    process.env.SCHEDULED_JOBS_ENABLED = 'false';
    const off = await new CronLeaseService(prisma, new ConfigService(process.env as any), moduleRef).runScheduled(job, work);
    check('SCHEDULED_JOBS_ENABLED=false: the server stays out', !off.ran && off.reason === 'disabled', off);
  } finally {
    await prisma.cronLease.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
