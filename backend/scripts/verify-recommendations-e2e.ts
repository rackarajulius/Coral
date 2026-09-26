// Checks the recommendation stack end-to-end against the real
// database, inside ONE transaction that is always rolled back: nothing is
// committed and other connections never see it. Uses dev.candidate@coral.test.
//
//   npm run verify:recommendations:e2e
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { EmailPreferencesService } from '../src/notifications/email-preferences.service';
import { BillingService } from '../src/billing/billing.service';
import { JobFanoutService } from '../src/recommendations/job-fanout.service';
import { JobBoostService } from '../src/recommendations/job-boost.service';
import { JobRecommendationsService } from '../src/recommendations/job-recommendations.service';
import { RecommendationStatsService } from '../src/recommendations/recommendation-stats.service';
import { JobAlertsService } from '../src/job-alerts/job-alerts.service';
import { FairnessService } from '../src/fairness/fairness.service';

const ROLLBACK = new Error('ROLLBACK');
let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

(async () => {
  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  const seeker = await prisma.user.findUnique({
    where: { email: 'dev.candidate@coral.test' },
    select: { id: true, role: true, status: true },
  });
  if (!seeker) {
    console.log('dev.candidate@coral.test not found');
    process.exit(1);
  }
  const employerJob = await prisma.job.findFirst({ where: { status: 'active' }, select: { postedById: true } });
  console.log('seeker', seeker.id.slice(0, 8), seeker.role, seeker.status, '| employer', employerJob.postedById.slice(0, 8));
  const recsBefore = await prisma.jobRecommendation.count();

  try {
    await prisma.$transaction(
      async (tx: any) => {
        const emailStub = {
          sendPlainText: async () => {
            throw new Error('email should not be called');
          },
        } as any;
        const ctx = new CompanyContextService(tx);
        const notifications = new NotificationsService(tx, emailStub);
        const emailPrefs = new EmailPreferencesService(tx, config);
        const billing = new BillingService(tx, ctx, config);
        const fanout = new JobFanoutService(tx, ctx, notifications, emailPrefs, emailStub, config);
        const boosts = new JobBoostService(tx, ctx, billing, fanout);
        const recs = new JobRecommendationsService(tx);
        const stats = new RecommendationStatsService(tx, ctx, boosts);
        const alerts = new JobAlertsService(tx, emailStub, config, notifications, emailPrefs);
        const fairness = new FairnessService(tx);
        const seekerUser = { id: seeker.id } as any;
        const employerUser = { id: employerJob.postedById } as any;

        // Fixture (inside the tx only): a matching profile and a freshly published job.
        await tx.jobSeekerProfile.update({
          where: { userId: seeker.id },
          data: {
            skills: ['Node.js', 'PostgreSQL', 'AWS'],
            skillsNormalized: ['node.js', 'postgresql', 'aws'],
            currentTitle: 'Backend Engineer',
            city: 'Toronto',
            jobTypes: [],
            remotePreference: null,
            notificationSettings: { pushJobAlerts: true, emailJobAlerts: true },
          },
        });
        const job = await tx.job.create({
          data: {
            postedById: employerJob.postedById,
            title: 'Senior Backend Engineer (TX TEST)',
            slug: `tx-test-${Date.now()}`,
            description: 'Build APIs with Node.js',
            employmentType: 'full-time',
            experienceLevel: 'senior',
            location: 'Toronto, ON',
            skills: ['Node.js', 'PostgreSQL', 'AWS', 'Docker'],
            status: 'active',
            publishedAt: new Date(),
          },
        });

        // Phase 3: publish sweep
        await fanout.sweepNewJobs();
        const row = await tx.jobRecommendation.findUnique({
          where: { jobId_userId: { jobId: job.id, userId: seeker.id } },
        });
        check('sweep queued a recommendation for the matching seeker', !!row && row.source === 'publish' && !row.promoted, row && { score: row.score, reasons: row.reasons });
        check('sweep marked the job fanned out', !!(await tx.job.findUnique({ where: { id: job.id } })).fannedOutAt);
        const teamGot = await tx.jobRecommendation.count({ where: { jobId: job.id, userId: employerJob.postedById } });
        check('posting company members are never recommended their own job', teamGot === 0);

        // Digest + cap
        check('digest delivers', await fanout.digestFor(seeker.id));
        const note = await tx.notification.findFirst({
          where: { userId: seeker.id, type: 'job_recommendation' },
          orderBy: { createdAt: 'desc' },
        });
        check('in-app digest notification written', !!note && note.link.includes(`job=${job.id}`) && note.link.includes('src=rec'), note && { title: note.title, link: note.link });
        check('row marked notified', !!(await tx.jobRecommendation.findUnique({ where: { id: row.id } })).notifiedAt);
        check('second digest the same day is refused (cap)', (await fanout.digestFor(seeker.id)) === false);

        // Phase 2: feed
        const feed1 = await recs.forSeeker(seekerUser);
        const item1 = feed1.items.find((i: any) => i.jobId === job.id);
        check('feed shows the job with reasons', !!item1 && item1.reasons.length > 0 && !item1.promoted, item1 && item1.reasons);

        // Phase 4: open + apply attribution
        await recs.markOpened(seekerUser, job.id);
        check('open recorded', !!(await tx.jobRecommendation.findUnique({ where: { id: row.id } })).openedAt);
        await tx.application.create({
          data: { jobId: job.id, applicantId: seeker.id, appliedAt: new Date(Date.now() + 1000) },
        });

        // Phase 5: boost
        const started = await boosts.start(employerUser, job.id);
        check('boost starts and reports allowance', started.boost.status === 'active' && started.allowance.used >= 1, started.allowance);
        let conflict = false;
        try {
          await boosts.start(employerUser, job.id);
        } catch (e: any) {
          conflict = e.status === 409;
        }
        check('second boost on the same job is refused', conflict);
        let foreign = false;
        try {
          await boosts.start(seekerUser, job.id);
        } catch (e: any) {
          foreign = e.status === 404;
        }
        check('another company cannot boost this job (reads as not found)', foreign);

        const reach = await stats.forEmployer(employerUser);
        const r = reach.jobs.find((j: any) => j.jobId === job.id);
        check('reach: delivered, opened 1, applied 1 (attributed)', !!r && r.delivered >= 1 && r.opened === 1 && r.applied === 1, r && { delivered: r.delivered, opened: r.opened, applied: r.applied, boost: r.boost?.status });

        // Promoted slot — needs a seeker who has not applied; drop the application for this check.
        await tx.application.deleteMany({ where: { jobId: job.id, applicantId: seeker.id } });
        const feed2 = await recs.forSeeker(seekerUser);
        check('boosted job is labelled Promoted at the top', feed2.items[0]?.jobId === job.id && feed2.items[0]?.promoted === true, feed2.items.slice(0, 2).map((i: any) => [i.title, i.promoted]));

        // Dismiss
        await recs.dismiss(seekerUser, job.id);
        const feed3 = await recs.forSeeker(seekerUser);
        check('dismissed job leaves the feed', !feed3.items.some((i: any) => i.jobId === job.id));
        await recs.undismiss(seekerUser, job.id);
        check('undo brings it back', (await recs.forSeeker(seekerUser)).items.some((i: any) => i.jobId === job.id));

        // Phase 0: job alerts — keyword lower-case vs skill "Docker", type/level written differently
        await tx.jobAlert.create({
          data: { userId: seeker.id, name: 'node', keywords: ['docker'], frequency: 'instant', jobType: 'Full Time', experienceLevel: 'Senior level' },
        });
        const out = await alerts.dispatchDueAlerts({ userId: seeker.id, force: true });
        check('alert matched (case/format-insensitive), in-app delivered, email skipped', out.data.notified === 1 && out.data.failed === 0, out.data);
        const alertNote = await tx.notification.findFirst({ where: { userId: seeker.id, type: 'job_alert' } });
        check('job_alert notification links to the job', !!alertNote && alertNote.link.includes(job.id), alertNote && alertNote.title);
        await tx.jobSeekerProfile.update({
          where: { userId: seeker.id },
          data: { notificationSettings: { pushJobAlerts: false, emailJobAlerts: false } },
        });
        await tx.jobAlert.updateMany({ where: { userId: seeker.id }, data: { lastSentAt: null } });
        const off = await alerts.dispatchDueAlerts({ userId: seeker.id, force: true });
        check('both alert channels off: nothing sent, nothing failed', off.data.notified === 0 && off.data.failed === 0, off.data);

        // Unsubscribe
        const url = new URL(emailPrefs.unsubscribeUrl(seeker.id, 'job_recommendations'));
        const sig = url.searchParams.get('s')!;
        let badRejected = false;
        try {
          await emailPrefs.unsubscribe(seeker.id, 'job_recommendations', sig.slice(0, -2) + 'xx');
        } catch {
          badRejected = true;
        }
        check('tampered unsubscribe link rejected', badRejected);
        let crossRejected = false;
        try {
          await emailPrefs.unsubscribe(seeker.id, 'job_alerts', sig);
        } catch {
          crossRejected = true;
        }
        check('a signature for one topic does not unsubscribe another', crossRejected);
        await emailPrefs.unsubscribe(seeker.id, 'job_recommendations', sig);
        const prefs = (await tx.jobSeekerProfile.findUnique({ where: { userId: seeker.id } })).notificationSettings;
        check('valid link turns off just that switch', prefs.emailJobRecommendations === false && prefs.pushJobAlerts === false, prefs);

        // Fairness report runs
        const fr = await fairness.recommendationReach({});
        check('fairness reach report runs', typeof fr.available === 'boolean', { available: fr.available, note: fr.note });

        throw ROLLBACK;
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  } catch (e) {
    if (e !== ROLLBACK) {
      console.error('ERROR', e);
      fails++;
    }
  }

  const leaked = await prisma.job.count({ where: { title: { contains: '(TX TEST)' } } });
  check('rolled back: no test job left behind', leaked === 0);
  const recsAfter = await prisma.jobRecommendation.count();
  check('rolled back: recommendation count unchanged', recsAfter === recsBefore, { recsBefore, recsAfter });
  await prisma.$disconnect();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
