// Checks offer signals: the rules, the privacy line on salary expectations,
// the snapshot taken at send, and the outcomes report's thresholds.
//
//   npm run verify:offer-signals
//
// Rules run in memory. Database checks run inside ONE transaction that is
// always rolled back, with notifications and audit stubbed.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { OfferSignalsService } from '../src/ats/offer-signals.service';
import { OffersService } from '../src/ats/offers.service';
import { NEVER_USED, OfferFacts, offerSignals, parseSalaryText } from '../src/ats/offer-signal.rules';

const ROLLBACK = new Error('ROLLBACK');
let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

const DAY = 86_400_000;
const now = new Date('2026-10-01T12:00:00Z');
const base = (o: Partial<OfferFacts> = {}): OfferFacts => ({
  now,
  status: 'DRAFT',
  amountMinor: 8_500_000, // CAD 85,000
  currency: 'cad',
  period: 'yearly',
  startDate: new Date(now.getTime() + 30 * DAY),
  expiresAt: null,
  sentAt: null,
  respondedAt: null,
  appliedAt: new Date(now.getTime() - 20 * DAY),
  job: { salaryMin: 90_000, salaryMax: 110_000, salaryCurrency: 'CAD', salaryPeriod: 'yearly' },
  market: { median: null, samples: 0 },
  expectation: { shared: false, text: null },
  usualDaysToOffer: null,
  interviews: { attended: 0, declined: 0 },
  messages: { lastFromCandidate: null, lastFromCompany: null },
  ...o,
});
const ids = (f: OfferFacts) => offerSignals(f).signals.map((s) => s.id);
const sig = (f: OfferFacts, id: string) => offerSignals(f).signals.find((s) => s.id === id);
const skipped = (f: OfferFacts, id: string) => offerSignals(f).notChecked.find((n) => n.id === id);

(async () => {
  // 1. Rules
  check('below the advertised range, with the %', /6% below the CAD 90,000–110,000/.test(sig(base(), 'below_posted_range')?.detail ?? ''), sig(base(), 'below_posted_range')?.detail);
  check('within the range is good', sig(base({ amountMinor: 10_000_000 }), 'within_posted_range')?.tone === 'good');
  check('a different currency is not compared, and says why', !!skipped(base({ currency: 'usd' }), 'posted_range') && !ids(base({ currency: 'usd' })).some((i) => i.includes('posted_range')));
  check("a range with no period isn't assumed to be yearly", /per year, month or hour/.test(skipped(base({ job: { ...base().job, salaryPeriod: null } }), 'posted_range')?.why ?? ''));

  check('≥10% below the Coral median is a caution', sig(base({ market: { median: 100_000, samples: 5 } }), 'below_market')?.tone === 'caution');
  check('within 10% is "in line"', sig(base({ market: { median: 88_000, samples: 5 } }), 'in_line_with_market')?.tone === 'info');
  check('too few similar posts: not compared', /too few/.test(skipped(base({ market: { median: null, samples: 2 } }), 'market')?.why ?? ''));

  // Privacy: a hidden expectation must read the same whether or not one exists.
  const hiddenNone = skipped(base({ expectation: { shared: false, text: null } }), 'expectation');
  const hiddenSome = skipped(base({ expectation: { shared: false, text: '$120k' } }), 'expectation');
  check(
    "an unshared expectation is never used — and doesn't reveal whether one exists",
    JSON.stringify(hiddenNone) === JSON.stringify(hiddenSome) && !ids(base({ expectation: { shared: false, text: '$120k' } })).some((i) => i.includes('expectation')),
    hiddenSome,
  );
  check('a shared expectation above the offer is a caution', /below the CAD 95,000 they shared/.test(sig(base({ expectation: { shared: true, text: '$95k' } }), 'below_expectation')?.detail ?? ''));
  check('a shared range is read from its low end', sig(base({ expectation: { shared: true, text: 'CAD 80,000–90,000' } }), 'meets_expectation')?.tone === 'good');
  check('an expectation in another currency is not compared', !!skipped(base({ expectation: { shared: true, text: 'USD 90k' } }), 'expectation'));

  check('slower than the usual process is a caution', sig(base({ appliedAt: new Date(now.getTime() - 41 * DAY), usualDaysToOffer: { median: 20, offers: 6 } }), 'slow_process')?.tone === 'caution');
  check('without enough history, process length is just a fact', sig(base(), 'time_in_process')?.tone === 'info');
  check('interviews attended and declined both show', ids(base({ interviews: { attended: 2, declined: 1 } })).join() .includes('interviewed') && ids(base({ interviews: { attended: 2, declined: 1 } })).includes('declined_interview'));
  check('an unanswered message older than a week is a caution', sig(base({ messages: { lastFromCandidate: new Date(now.getTime() - 20 * DAY), lastFromCompany: new Date(now.getTime() - 9 * DAY) } }), 'unanswered_message')?.tone === 'caution');
  check('a recent reply is good', sig(base({ messages: { lastFromCandidate: new Date(now.getTime() - 2 * DAY), lastFromCompany: new Date(now.getTime() - 3 * DAY) } }), 'recently_in_touch')?.tone === 'good');
  check('no messages: says so rather than guessing', !!skipped(base(), 'responsiveness'));
  check('a start date inside two weeks is a caution', sig(base({ startDate: new Date(now.getTime() + 10 * DAY) }), 'short_notice_start')?.tone === 'caution');
  check('a sent offer waiting 6 days is a caution', sig(base({ status: 'SENT', sentAt: new Date(now.getTime() - 6 * DAY) }), 'awaiting_answer')?.tone === 'caution');
  check('a deadline under 2 days with no answer is a caution', sig(base({ status: 'SENT', sentAt: new Date(now.getTime() - DAY), expiresAt: new Date(now.getTime() + DAY) }), 'deadline_close')?.tone === 'caution');
  check('what is never used is always listed', NEVER_USED.every((n) => offerSignals(base()).notChecked.some((x) => x.id === n.id)));
  check(
    'no signal is a probability or a score',
    offerSignals(base({ market: { median: 100_000, samples: 5 }, interviews: { attended: 1, declined: 1 } })).signals.every(
      (s) => !/likel|probab|score|chance/i.test(`${s.title} ${s.detail}`),
    ),
  );
  check(
    'salary text parsing',
    JSON.stringify(['$80k', '95,000/yr', '45 per hour', 'negotiable'].map((t) => parseSalaryText(t) && [parseSalaryText(t)!.amount, parseSalaryText(t)!.period])) ===
      JSON.stringify([[80000, 'yearly'], [95000, 'yearly'], [45, 'hourly'], null]),
  );

  // Outcomes thresholds, on synthetic decided offers.
  const outcomesWith = (rows: { status: string; signalsAtSend: unknown }[]) =>
    new OfferSignalsService(
      { offer: { findMany: async () => rows } } as any,
      { requireForUser: async () => ({ companyId: 'c', memberUserIds: [] }) } as any,
    ).outcomes({ id: 'u' } as any);
  const mk = (n: number, status: string, withBelow: boolean) =>
    Array.from({ length: n }, () => ({ status, signalsAtSend: withBelow ? [{ id: 'below_posted_range', tone: 'caution' }] : [{ id: 'within_posted_range', tone: 'good' }] }));
  const few = await outcomesWith([...mk(3, 'ACCEPTED', false), ...mk(2, 'DECLINED', true)]);
  check('below 10 decided offers: counts only, no rates', few.acceptanceRate === null && few.bySignal.every((s) => s.withSignal.acceptanceRate === null) && !!few.note, few.note);
  const many = await outcomesWith([...mk(9, 'ACCEPTED', false), ...mk(1, 'EXPIRED', false), ...mk(3, 'ACCEPTED', true), ...mk(7, 'DECLINED', true)]);
  const below = many.bySignal.find((s) => s.id === 'below_posted_range');
  check('with enough: acceptance with vs without a signal (expired counts as not accepted)', many.acceptanceRate === 60 && below?.withSignal.acceptanceRate === 30 && below?.without.acceptanceRate === 90, below);

  // 2. Database, rolled back
  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  try {
    await prisma.$transaction(
      async (tx: any) => {
        const app = await tx.application.findFirst({ select: { id: true, applicantId: true, job: { select: { id: true, postedById: true } } } });
        if (!app) throw new Error('No application to test with');
        const employerId = app.job.postedById;
        await tx.companyMember.deleteMany({ where: { userId: employerId } });
        const company = await tx.company.create({ data: { name: 'Offer test co (rolled back)' } });
        await tx.companyMember.create({ data: { companyId: company.id, userId: employerId, role: 'OWNER', status: 'ACTIVE' } });
        await tx.job.update({ where: { id: app.job.id }, data: { salaryMin: 90_000, salaryMax: 110_000, salaryCurrency: 'CAD', salaryPeriod: 'yearly' } });
        await tx.jobSeekerProfile.updateMany({ where: { userId: app.applicantId }, data: { salaryExpectation: '$120k', privacySettings: { showSalaryExpectations: false } } });
        await tx.offer.deleteMany({ where: { applicationId: app.id } });

        const ctx = new CompanyContextService(tx);
        const signals = new OfferSignalsService(tx, ctx);
        const employer = { id: employerId } as any;

        const preview = await signals.forApplication(employer, app.id, { salaryAmount: 8_500_000, salaryCurrency: 'cad', salaryPeriod: 'yearly' });
        check('preview of unsaved values: below the advertised range', preview.signals.some((s) => s.id === 'below_posted_range'), preview.signals.map((s) => s.id));
        check('their hidden expectation is not used, though one is on file', !preview.signals.some((s) => s.id.includes('expectation')) && preview.notChecked.some((n) => n.id === 'expectation'));

        await tx.jobSeekerProfile.updateMany({ where: { userId: app.applicantId }, data: { privacySettings: { showSalaryExpectations: true } } });
        const shared = await signals.forApplication(employer, app.id, { salaryAmount: 8_500_000, salaryCurrency: 'cad', salaryPeriod: 'yearly' });
        check('once they choose to share it, it is compared', shared.signals.some((s) => s.id === 'below_expectation'), shared.signals.find((s) => s.id === 'below_expectation')?.detail);

        const stranger = await tx.user.findFirst({ where: { role: 'EMPLOYER', id: { not: employerId } }, select: { id: true } });
        if (stranger) {
          await tx.companyMember.deleteMany({ where: { userId: stranger.id } });
          const other = await tx.company.create({ data: { name: 'Other co (rolled back)' } });
          await tx.companyMember.create({ data: { companyId: other.id, userId: stranger.id, role: 'OWNER', status: 'ACTIVE' } });
          let refused = '';
          try {
            await signals.forApplication({ id: stranger.id } as any, app.id);
          } catch (e) {
            refused = (e as Error).message;
          }
          check("another company can't read these signals", refused === 'Application not found', refused);
        }

        const offers = new OffersService(tx, ctx, { recordFor: async () => undefined, record: async () => undefined } as any, { create: async () => ({ id: 'n' }) } as any, signals);
        const draft = await offers.upsertDraft(employer, app.id, { salaryAmount: 8_500_000, salaryCurrency: 'cad', salaryPeriod: 'yearly' });
        await offers.send(employer, draft.id);
        const sent = await tx.offer.findUnique({ where: { id: draft.id } });
        const snap = (sent.signalsAtSend ?? []) as { id: string; tone: string }[];
        check('sending freezes the signals onto the offer (ids and tones only)', snap.some((s) => s.id === 'below_posted_range') && snap.every((s) => Object.keys(s).join() === 'id,tone'), snap);
        check('the snapshot leaves out the waiting-for-an-answer state', !snap.some((s) => s.id.startsWith('awaiting') || s.id === 'deadline_close'));

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
  const leftover = await prisma.company.count({ where: { name: { contains: '(rolled back)' } } });
  check('rolled back: nothing left behind', leftover === 0, leftover);
  await prisma.$disconnect();

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
