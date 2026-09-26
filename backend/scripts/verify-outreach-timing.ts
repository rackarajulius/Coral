// Checks outreach timing: working-hours advice, scheduled delivery, and the
// send-time comparison.
//
//   npm run verify:outreach-timing
//
// Rules are checked in memory. Everything touching the database runs inside ONE
// transaction that is always rolled back, with email and notifications stubbed.
// The candidate is dev.candidate@coral.test, never a real account.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { OutreachService } from '../src/employer-hiring/outreach.service';
import { JobSeekersService } from '../src/job-seekers/job-seekers.service';
import { adviseTiming } from '../src/employer-hiring/outreach-timing';

const ROLLBACK = new Error('ROLLBACK');
let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};
const expectThrow = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return '';
  } catch (e) {
    return (e as Error).message;
  }
};

(async () => {
  // 1. Rules
  const cases: [string, string, string, boolean, string | null][] = [
    ['Toronto weekday afternoon', 'America/Toronto', '2026-09-29T18:00:00Z', true, null],
    ['Toronto 23:00 → next morning', 'America/Toronto', '2026-09-30T03:00:00Z', false, 'Wed 09:00'],
    ['Kampala Friday evening → Monday', 'Africa/Kampala', '2026-10-02T15:30:00Z', false, 'Mon 09:00'],
    ['Kolkata (+5:30) Saturday → Monday', 'Asia/Kolkata', '2026-10-03T04:30:00Z', false, 'Mon 09:00'],
    ['Kathmandu (+5:45) Sunday → Monday', 'Asia/Kathmandu', '2026-10-04T14:15:00Z', false, 'Mon 09:00'],
    ['across the November DST change', 'America/Toronto', '2026-11-01T03:00:00Z', false, 'Mon 09:00'],
    ['17:00 exactly is after hours', 'America/Toronto', '2026-09-29T21:00:00Z', false, 'Wed 09:00'],
  ];
  for (const [label, zone, iso, goodNow, suggested] of cases) {
    const a = adviseTiming(zone, new Date(iso));
    check(`timing: ${label}`, a.goodNow === goodNow && a.suggestedLocal === suggested, { localNow: a.localNow, suggested: a.suggestedLocal });
  }
  const dst = adviseTiming('America/Toronto', new Date('2026-11-01T03:00:00Z'));
  check('DST: Monday 09:00 EST is 14:00 UTC, not 13:00', dst.suggestedAt === '2026-11-02T14:00:00.000Z', dst.suggestedAt);
  check('unknown or invalid timezone gives no suggestion', !adviseTiming(null).known && !adviseTiming('Mars/Olympus').known);

  // 2. Database, rolled back
  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  try {
    await prisma.$transaction(
      async (tx: any) => {
        const seeker = await tx.user.findUnique({ where: { email: 'dev.candidate@coral.test' }, select: { id: true } });
        if (!seeker) throw new Error('dev.candidate@coral.test not found');
        await tx.jobSeekerProfile.update({
          where: { userId: seeker.id },
          data: { discoverable: true, privacySettings: { profileVisible: true }, timezone: null },
        });
        const employerRow = await tx.user.findFirst({ where: { role: 'EMPLOYER' }, select: { id: true } });
        const employer = { id: employerRow.id } as any;

        const notes: any[] = [];
        const emails: any[] = [];
        const outreach = new OutreachService(
          tx,
          {} as any,
          { create: async (n: any) => (notes.push(n), { id: 'n' }) } as any,
          { sendPlainText: async (m: any) => emails.push(m) } as any,
          new CompanyContextService(tx),
        );
        const seekers = new JobSeekersService(tx, {} as any, {} as any, {} as any, {} as any, {} as any);

        check('before they use Coral, their timezone is unknown', (await outreach.timing(seeker.id)).known === false);
        const bogus = await seekers.setTimezone(seeker.id, 'Not/AZone');
        check('an invalid zone is not stored', bogus.updated === false);
        const first = await seekers.setTimezone(seeker.id, 'Africa/Kampala');
        const again = await seekers.setTimezone(seeker.id, 'Africa/Kampala');
        check('first report is stored; a repeat writes nothing', first.updated === true && again.updated === false, { first, again });
        const advice = await outreach.timing(seeker.id);
        check('then advice uses their zone', advice.known && advice.timezone === 'Africa/Kampala', advice.reason);

        const base = { candidateId: seeker.id, subject: 'Hello', message: 'A role you might like.' };
        const soon = await expectThrow(() => outreach.send(employer, { ...base, scheduledFor: new Date(Date.now() + 10_000).toISOString() }));
        const far = await expectThrow(() => outreach.send(employer, { ...base, scheduledFor: new Date(Date.now() + 20 * 86_400_000).toISOString() }));
        check('scheduling needs at least a minute and at most 14 days', /at least a minute/.test(soon) && /14 days/.test(far), { soon, far });

        const at = new Date(Date.now() + 3 * 3_600_000).toISOString();
        const scheduled = await outreach.send(employer, { ...base, scheduledFor: at });
        const row = await tx.outreachMessage.findUnique({ where: { id: scheduled.id } });
        check('a scheduled message is held: nothing sent, nothing notified', row.status === 'scheduled' && notes.length === 0 && emails.length === 0 && scheduled.scheduledFor === at);
        check('the candidate cannot see it yet', /not found/i.test(await expectThrow(() => outreach.readForCandidate(seeker.id, scheduled.id))));
        const contacted = await outreach.contactedAmong(employer, [seeker.id]);
        check('the team sees them as already approached, with the time', !!contacted[seeker.id]?.scheduledFor);
        check('it does not count as sent in the stats', (await outreach.stats(employer)).sent === 0);

        await outreach.cancelScheduled(employer, scheduled.id);
        const twice = await expectThrow(() => outreach.cancelScheduled(employer, scheduled.id));
        check('cancelling works once; after that it says so', (await tx.outreachMessage.findUnique({ where: { id: scheduled.id } })).status === 'cancelled' && /already gone out, or was cancelled/.test(twice), twice);
        check('a cancelled message is not "contacted"', !(await outreach.contactedAmong(employer, [seeker.id]))[seeker.id]);

        // Due now: the delivery job sends it exactly once.
        const due = await outreach.send(employer, { ...base, scheduledFor: at });
        await tx.outreachMessage.update({ where: { id: due.id }, data: { scheduledFor: new Date(Date.now() - 60_000) } });
        await outreach.deliverScheduled();
        await outreach.deliverScheduled();
        const delivered = await tx.outreachMessage.findUnique({ where: { id: due.id } });
        check(
          'the delivery job sends it once, and records their timezone',
          delivered.status === 'sent' && !!delivered.sentAt && delivered.candidateTimezone === 'Africa/Kampala' && notes.filter((n) => n.link === `/outreach/${due.id}`).length === 1,
          { status: delivered.status, tz: delivered.candidateTimezone, notes: notes.length },
        );
        check('now the candidate can open it', (await outreach.readForCandidate(seeker.id, due.id)).id === due.id);

        // They opt out while a message waits: it is not delivered; the sender is told.
        const waiting = await outreach.send(employer, { ...base, scheduledFor: at });
        await tx.outreachMessage.update({ where: { id: waiting.id }, data: { scheduledFor: new Date(Date.now() - 60_000) } });
        await tx.jobSeekerProfile.update({ where: { userId: seeker.id }, data: { discoverable: false } });
        const before = notes.length;
        await outreach.deliverScheduled();
        const dropped = await tx.outreachMessage.findUnique({ where: { id: waiting.id } });
        check(
          'someone who opted out meanwhile is not sent it; the recruiter is told',
          dropped.status === 'cancelled' && notes.length === before + 1 && notes[notes.length - 1].userId === employer.id,
          notes[notes.length - 1]?.title,
        );

        // The comparison: silent below the sample, reported above it.
        const statsFor = (inH: [number, number], outH: [number, number]) => {
          const mk = (n: number, replied: number, iso: string) =>
            Array.from({ length: n }, (_, i) => ({ createdAt: new Date(iso), candidateTimezone: 'Africa/Kampala', respondedAt: i < replied ? new Date() : null }));
          // 10:00 Kampala on a Tuesday, and 22:00.
          return (outreach as any).timingStats([...mk(inH[0], inH[1], '2026-09-29T07:00:00Z'), ...mk(outH[0], outH[1], '2026-09-29T19:00:00Z')]);
        };
        const small = statsFor([12, 6], [8, 1]);
        const big = statsFor([15, 9], [20, 4]);
        check('below the sample, no comparison', small.comparison === null && small.withTimezone === 20, small);
        check(
          'with enough, reply rates by their local send time',
          big.comparison?.inHours.replyRate === 60 && big.comparison?.outOfHours.replyRate === 20 && big.comparison?.inHours.sent === 15,
          big.comparison,
        );

        throw ROLLBACK;
      },
      { timeout: 90_000, maxWait: 15_000 },
    );
  } catch (e) {
    if (e !== ROLLBACK) {
      console.error('ERROR', e);
      fails++;
    }
  }
  const tz = await prisma.jobSeekerProfile.findFirst({ where: { user: { email: 'dev.candidate@coral.test' } }, select: { timezone: true } });
  check('rolled back: dev.candidate has no stored timezone', tz?.timezone === null, tz);
  await prisma.$disconnect();

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
