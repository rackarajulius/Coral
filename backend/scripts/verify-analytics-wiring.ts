/**
 * Confirms the wired call sites actually capture: hitting the real job and
 * company endpoints as an anonymous visitor should produce events attributed
 * to the right employer, with the referrer reduced to a host.
 *
 *   npm run verify:analytics:wiring
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);

  try {
    const job = await prisma.job.findFirst({ select: { id: true, title: true, postedById: true } });
    if (!job) {
      console.log('\n  No jobs in the database. Seed one and re-run.\n');
      return;
    }

    const before = await prisma.analyticsEvent.count({ where: { type: 'job_view' } });
    const ua = `wiring-test-${Date.now()}`;

    const res = await fetch(`${API}/jobs/${job.id}`, {
      headers: { 'User-Agent': ua, Referer: 'https://www.linkedin.com/feed/some/private/path?q=secret' },
    });
    console.log(`\n  GET /jobs/${job.id.slice(0, 8)} -> ${res.status}`);

    await new Promise((r) => setTimeout(r, 500));

    const after = await prisma.analyticsEvent.count({ where: { type: 'job_view' } });
    const latest = await prisma.analyticsEvent.findFirst({
      where: { type: 'job_view', jobId: job.id },
      orderBy: { occurredAt: 'desc' },
    });

    console.log(`  job_view events: ${before} -> ${after}`);
    console.log(`  captured from the page read : ${after > before ? 'OK' : 'FAIL'}`);
    console.log(`  attributed to job owner     : ${latest?.employerId === job.postedById ? 'OK' : 'WRONG'}`);
    console.log(`  referrer stored as          : ${JSON.stringify(latest?.source)} (host only, no path/query)`);
    console.log(`  viewer                      : ${latest?.viewerId ?? 'anonymous'}`);

    // Company profile view
    const company = await prisma.employerProfile.findFirst({ select: { id: true, userId: true } });
    if (company) {
      const cBefore = await prisma.analyticsEvent.count({ where: { type: 'profile_view' } });
      const cRes = await fetch(`${API}/employers/companies/${company.id}`, {
        headers: { 'User-Agent': `${ua}-company` },
      });
      await new Promise((r) => setTimeout(r, 500));
      const cAfter = await prisma.analyticsEvent.count({ where: { type: 'profile_view' } });
      const cLatest = await prisma.analyticsEvent.findFirst({
        where: { type: 'profile_view' },
        orderBy: { occurredAt: 'desc' },
      });
      console.log(`\n  GET /employers/companies/:id -> ${cRes.status}`);
      console.log(`  profile_view events: ${cBefore} -> ${cAfter}`);
      console.log(
        `  attributed to profile owner : ${cAfter > cBefore && cLatest?.employerId === company.userId ? 'OK' : cAfter > cBefore ? 'WRONG' : 'not captured'}`,
      );
    } else {
      console.log('\n  No employer profiles — skipped the profile_view check.');
    }

    const byType = await prisma.analyticsEvent.groupBy({ by: ['type'], _count: { _all: true } });
    console.log('\n  Events by type');
    for (const r of byType) console.log(`    ${r.type.padEnd(15)} ${r._count._all}`);
    console.log('');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
