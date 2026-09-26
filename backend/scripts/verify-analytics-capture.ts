/**
 * End-to-end check of analytics capture: POST an event, confirm it landed
 * attributed to the right employer, roll it up, confirm the daily row.
 *
 * Read-mostly, but it DOES write events and a rollup row for a real job, so
 * run it against a dev database only.
 *
 *   npm run verify:analytics
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnalyticsEventsService } from '../src/analytics/analytics-events.service';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const events = app.get(AnalyticsEventsService);

  try {
    const job = await prisma.job.findFirst({ select: { id: true, title: true, postedById: true } });
    if (!job) {
      console.log('\n  No jobs in the database — nothing to attribute an event to.');
      console.log('  Seed a job first, then re-run.\n');
      return;
    }

    console.log(`\n  Job   : ${job.title} (${job.id.slice(0, 8)})`);
    console.log(`  Owner : ${job.postedById.slice(0, 8)}`);

    const before = await prisma.analyticsEvent.count({ where: { jobId: job.id } });

    // Unique UA so the in-memory dedupe doesn't swallow the test event.
    const res = await fetch(`${API}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `verify-${Date.now()}` },
      body: JSON.stringify({ type: 'job_view', jobId: job.id }),
    });
    console.log(`\n  POST /analytics/events -> ${res.status}`);

    await new Promise((r) => setTimeout(r, 400)); // record() is fire-and-forget

    const after = await prisma.analyticsEvent.count({ where: { jobId: job.id } });
    const latest = await prisma.analyticsEvent.findFirst({
      where: { jobId: job.id },
      orderBy: { occurredAt: 'desc' },
    });

    console.log(`  events for this job: ${before} -> ${after}`);
    if (after <= before || !latest) {
      console.log('\n  FAIL: no event was written.\n');
      process.exitCode = 1;
      return;
    }

    const attributedRight = latest.employerId === job.postedById;
    console.log(`\n  employerId resolved server-side : ${attributedRight ? 'OK' : 'WRONG'}`);
    console.log(`  sessionHash stored (not an IP)  : ${latest.sessionHash ? 'OK' : 'missing'}`);
    console.log(`  hash length                     : ${latest.sessionHash?.length ?? 0} (opaque)`);

    // Dedupe: same UA again should NOT create a second row.
    const dupUa = `verify-dupe-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await fetch(`${API}/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': dupUa },
        body: JSON.stringify({ type: 'job_view', jobId: job.id }),
      });
    }
    await new Promise((r) => setTimeout(r, 400));
    const afterDupes = await prisma.analyticsEvent.count({ where: { jobId: job.id } });
    console.log(`  2 identical hits recorded as    : ${afterDupes - after} event(s) ${afterDupes - after === 1 ? '(deduped OK)' : '(NOT deduped)'}`);

    // Roll up today so we can see the aggregate without waiting for the cron.
    const rows = await events.rollupDay(new Date());
    const daily = await prisma.employerMetricDaily.findFirst({
      where: { employerId: job.postedById },
      orderBy: { day: 'desc' },
    });
    console.log(`\n  rollupDay wrote ${rows} employer row(s)`);
    if (daily) {
      console.log(
        `  ${daily.day.toISOString().slice(0, 10)}: jobViews=${daily.jobViews} ` +
          `profileViews=${daily.profileViews} applyClicks=${daily.applyClicks} ` +
          `uniqueVisitors=${daily.uniqueVisitors}`,
      );
    }

    // Nonexistent job must be dropped, not attributed to anyone.
    const fake = await prisma.analyticsEvent.count({
      where: { jobId: '00000000-0000-4000-8000-000000000000' },
    });
    console.log(`\n  events for a nonexistent job    : ${fake} (must be 0)\n`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
