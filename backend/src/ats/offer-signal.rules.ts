import { normalizePayPeriod } from '../common/job-text';

/**
 * Plain facts about an offer that bear on whether it will be accepted.
 *
 * Deliberately **not** a probability. A "72% likely to accept" score tends to
 * decide who is made an offer at all, and anything learned from the data
 * available here would lean on proxies — where someone lives, how long their
 * career is — that stand in for protected characteristics. So each signal is a
 * fact with its numbers, which a recruiter can check and act on (raise the
 * salary, move the start date, chase an answer), and nothing adds them up.
 *
 * What goes in is only what this company may already see: the offer and job,
 * pay posted for similar roles on Coral, this company's own history with the
 * candidate, and a salary expectation only if the candidate chose to share it.
 * Never their dealings with other employers, never anything demographic.
 */

export type SignalTone = 'caution' | 'good' | 'info';

export interface OfferSignal {
  /** Stable key: the outcomes report groups by it. */
  id: string;
  tone: SignalTone;
  title: string;
  /** The numbers behind it, written out. */
  detail: string;
}

export interface NotChecked {
  id: string;
  label: string;
  why: string;
}

export interface OfferFacts {
  now: Date;
  status: string;
  /** Minor units (cents), as the offer stores it. */
  amountMinor: number | null;
  currency: string;
  period: string | null;
  startDate: Date | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  appliedAt: Date;
  job: {
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    salaryPeriod: string | null;
  };
  /** Median midpoint of similar live posts elsewhere on Coral, same currency and period. */
  market: { median: number | null; samples: number };
  /** Only populated when the candidate turned on "show salary expectations". */
  expectation: { shared: boolean; text: string | null };
  /** This company's usual days from application to a sent offer, when it has enough history. */
  usualDaysToOffer: { median: number; offers: number } | null;
  interviews: { attended: number; declined: number };
  messages: { lastFromCandidate: Date | null; lastFromCompany: Date | null };
}

const DAY = 86_400_000;
/** Below this many past offers a company "usual" is an anecdote. */
export const MIN_OFFERS_FOR_USUAL = 5;
/** Two weeks' notice is the common expectation in Canada. */
const NOTICE_DAYS = 14;
/** Differences smaller than this are "in line", not a signal. */
const MARKET_BAND = 0.1;

/** Always listed, so nobody wonders whether these were weighed. */
export const NEVER_USED: NotChecked[] = [
  {
    id: 'other_employers',
    label: 'Their applications or offers elsewhere',
    why: 'Never used — what someone does with other employers is theirs.',
  },
  {
    id: 'demographics',
    label: 'Age, career length, or anything demographic',
    why: 'Never used — these are the proxies a hiring signal must not lean on.',
  },
  {
    id: 'private_preferences',
    label: 'Relocation, job type or availability preferences',
    why: 'Private to the candidate; they are not shown to employers.',
  },
];

const days = (ms: number) => Math.round(ms / DAY);
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

export function money(amount: number, currency: string): string {
  return `${currency.toUpperCase()} ${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * The first figure in free text, in whole units: "$80k", "80,000–90,000 CAD",
 * "95000/yr". Null when there is no number.
 */
export function parseSalaryText(text: string | null): {
  amount: number;
  currency: string | null;
  period: 'yearly' | 'monthly' | 'hourly' | null;
} | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const match = lower.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!match) return null;
  const amount = Number(match[1]) * (match[2] ? 1000 : 1);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = (lower.match(/\b(cad|usd|eur|gbp)\b/) ?? [])[1] ?? null;
  // A stated period wins; otherwise the size of the number is the only clue.
  const period =
    normalizePayPeriod(lower) ?? (amount >= 10_000 ? 'yearly' : amount < 500 ? 'hourly' : null);
  return { amount, currency, period };
}

export function offerSignals(f: OfferFacts): { signals: OfferSignal[]; notChecked: NotChecked[] } {
  const signals: OfferSignal[] = [];
  const notChecked: NotChecked[] = [];
  const offerAmount = f.amountMinor != null ? f.amountMinor / 100 : null;
  const offerPeriod = normalizePayPeriod(f.period);
  const cur = f.currency.toLowerCase();

  /* ---- pay against the range this company advertised ---- */
  const jobPeriod = normalizePayPeriod(f.job.salaryPeriod);
  const hasRange = f.job.salaryMin != null || f.job.salaryMax != null;
  if (offerAmount == null) {
    notChecked.push({ id: 'posted_range', label: 'Pay against your advertised range', why: 'No salary on the offer yet.' });
  } else if (!hasRange) {
    notChecked.push({ id: 'posted_range', label: 'Pay against your advertised range', why: 'The job did not advertise a salary.' });
  } else if (f.job.salaryCurrency.toLowerCase() !== cur || !jobPeriod || jobPeriod !== offerPeriod) {
    notChecked.push({
      id: 'posted_range',
      label: 'Pay against your advertised range',
      why: !jobPeriod
        ? "The job's range doesn't say whether it is per year, month or hour."
        : `The job advertised in ${f.job.salaryCurrency.toUpperCase()} per ${jobPeriod.replace('ly', '')}, the offer is in ${cur.toUpperCase()} per ${(offerPeriod ?? '?').replace('ly', '')}.`,
    });
  } else {
    const lo = f.job.salaryMin ?? f.job.salaryMax!;
    const hi = f.job.salaryMax ?? f.job.salaryMin!;
    const range = lo === hi ? money(lo, cur) : `${money(lo, cur)}–${money(hi, cur).replace(`${cur.toUpperCase()} `, '')}`;
    if (offerAmount < lo) {
      signals.push({
        id: 'below_posted_range',
        tone: 'caution',
        title: 'Below the range you advertised',
        detail: `${money(offerAmount, cur)} is ${Math.abs(pct(offerAmount, lo))}% below the ${range} the job listed. They applied expecting that range.`,
      });
    } else if (offerAmount > hi) {
      signals.push({ id: 'above_posted_range', tone: 'good', title: 'Above the range you advertised', detail: `${money(offerAmount, cur)} against the ${range} the job listed.` });
    } else {
      signals.push({ id: 'within_posted_range', tone: 'good', title: 'Within the range you advertised', detail: `${money(offerAmount, cur)} against the ${range} the job listed.` });
    }
  }

  /* ---- pay against similar roles on Coral ---- */
  if (offerAmount == null || !offerPeriod) {
    notChecked.push({ id: 'market', label: 'Pay against similar roles on Coral', why: 'No salary and period on the offer yet.' });
  } else if (f.market.median == null) {
    notChecked.push({
      id: 'market',
      label: 'Pay against similar roles on Coral',
      why:
        f.market.samples === 0
          ? `No similar live post on Coral lists pay in ${cur.toUpperCase()} per ${offerPeriod.replace('ly', '')}.`
          : `Only ${f.market.samples} similar live post${f.market.samples === 1 ? '' : 's'} list comparable pay — too few for a median.`,
    });
  } else {
    const diff = (offerAmount - f.market.median) / f.market.median;
    const basis = `the ${money(f.market.median, cur)} median of ${f.market.samples} similar live posts on Coral`;
    if (diff <= -MARKET_BAND) {
      signals.push({ id: 'below_market', tone: 'caution', title: 'Below what similar roles post', detail: `${Math.abs(Math.round(diff * 100))}% below ${basis}.` });
    } else if (diff >= MARKET_BAND) {
      signals.push({ id: 'above_market', tone: 'good', title: 'Above what similar roles post', detail: `${Math.round(diff * 100)}% above ${basis}.` });
    } else {
      signals.push({ id: 'in_line_with_market', tone: 'info', title: 'In line with similar roles', detail: `Within 10% of ${basis}.` });
    }
  }

  /* ---- pay against what they said they want, only if they shared it ---- */
  const expectation = f.expectation.shared ? parseSalaryText(f.expectation.text) : null;
  if (!f.expectation.shared) {
    // Says the same whether or not a figure exists — which is itself private.
    notChecked.push({ id: 'expectation', label: 'Their salary expectation', why: "They haven't chosen to share one with employers." });
  } else if (!expectation || offerAmount == null) {
    notChecked.push({ id: 'expectation', label: 'Their salary expectation', why: offerAmount == null ? 'No salary on the offer yet.' : "What they shared isn't a figure we can read." });
  } else if ((expectation.currency && expectation.currency !== cur) || (expectation.period && expectation.period !== offerPeriod)) {
    notChecked.push({ id: 'expectation', label: 'Their salary expectation', why: `They shared "${f.expectation.text}", which isn't in the offer's currency and period.` });
  } else {
    const assumed = expectation.currency ? '' : ` (no currency given; read as ${cur.toUpperCase()})`;
    if (offerAmount < expectation.amount) {
      signals.push({
        id: 'below_expectation',
        tone: 'caution',
        title: 'Below the salary they shared',
        detail: `${money(offerAmount, cur)} is ${Math.abs(pct(offerAmount, expectation.amount))}% below the ${money(expectation.amount, cur)} they shared${assumed}.`,
      });
    } else {
      signals.push({ id: 'meets_expectation', tone: 'good', title: 'Meets the salary they shared', detail: `${money(offerAmount, cur)} against the ${money(expectation.amount, cur)} they shared${assumed}.` });
    }
  }

  /* ---- how long this has taken ---- */
  const upTo = f.sentAt ?? f.now;
  const inProcess = days(upTo.getTime() - f.appliedAt.getTime());
  if (f.usualDaysToOffer && inProcess > f.usualDaysToOffer.median * 1.5) {
    signals.push({
      id: 'slow_process',
      tone: 'caution',
      title: 'Longer than your usual process',
      detail: `${inProcess} days since they applied; your median is ${f.usualDaysToOffer.median} days across ${f.usualDaysToOffer.offers} offers. A long process leaves more room for other offers to arrive.`,
    });
  } else {
    signals.push({
      id: 'time_in_process',
      tone: 'info',
      title: `${inProcess} day${inProcess === 1 ? '' : 's'} since they applied`,
      detail: f.usualDaysToOffer
        ? `Your median is ${f.usualDaysToOffer.median} days across ${f.usualDaysToOffer.offers} offers.`
        : `Your usual time appears after ${MIN_OFFERS_FOR_USUAL} sent offers.`,
    });
  }

  /* ---- their engagement with this company ---- */
  if (f.interviews.attended > 0) {
    signals.push({
      id: 'interviewed',
      tone: 'good',
      title: `Took part in ${f.interviews.attended} interview${f.interviews.attended === 1 ? '' : 's'}`,
      detail: 'Confirmed or completed with your company.',
    });
  }
  if (f.interviews.declined > 0) {
    signals.push({
      id: 'declined_interview',
      tone: 'caution',
      title: `Declined ${f.interviews.declined} interview proposal${f.interviews.declined === 1 ? '' : 's'}`,
      detail: 'Often only a clash of times — worth asking if it still suits them.',
    });
  }

  const { lastFromCandidate: theirs, lastFromCompany: ours } = f.messages;
  if (!theirs && !ours) {
    notChecked.push({ id: 'responsiveness', label: 'How quickly they reply', why: 'No messages exchanged in Coral yet.' });
  } else if (ours && (!theirs || theirs < ours) && f.now.getTime() - ours.getTime() > 7 * DAY) {
    signals.push({
      id: 'unanswered_message',
      tone: 'caution',
      title: 'Your last message is unanswered',
      detail: `You wrote ${days(f.now.getTime() - ours.getTime())} days ago and haven't heard back in Coral.`,
    });
  } else if (theirs) {
    const ago = days(f.now.getTime() - theirs.getTime());
    signals.push({
      id: 'recently_in_touch',
      tone: ago <= 7 ? 'good' : 'info',
      title: ago <= 7 ? 'Recently in touch' : 'Last heard from them a while ago',
      detail: `Their last message was ${ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`}.`,
    });
  }

  /* ---- the offer's own dates ---- */
  const from = f.sentAt ?? f.now;
  if (!f.startDate) {
    signals.push({ id: 'no_start_date', tone: 'info', title: 'No start date yet', detail: 'A concrete date helps them plan their notice.' });
  } else {
    const lead = days(f.startDate.getTime() - from.getTime());
    if (lead < NOTICE_DAYS) {
      signals.push({
        id: 'short_notice_start',
        tone: 'caution',
        title: 'Start date leaves little notice',
        detail: `Starts ${lead <= 0 ? 'immediately' : `${lead} day${lead === 1 ? '' : 's'}`} after the offer — less than the two weeks' notice most people owe their current employer.`,
      });
    }
  }

  if (f.status === 'SENT' && !f.respondedAt && f.sentAt) {
    const waiting = days(f.now.getTime() - f.sentAt.getTime());
    const left = f.expiresAt ? (f.expiresAt.getTime() - f.now.getTime()) / DAY : null;
    if (left != null && left <= 2 && left > 0) {
      signals.push({ id: 'deadline_close', tone: 'caution', title: 'Deadline close, no answer yet', detail: `Expires in ${Math.max(1, Math.round(left * 24))} hours; sent ${waiting} day${waiting === 1 ? '' : 's'} ago.` });
    } else if (waiting >= 5) {
      signals.push({ id: 'awaiting_answer', tone: 'caution', title: 'No answer yet', detail: `Sent ${waiting} days ago.` });
    } else {
      signals.push({ id: 'awaiting_answer_recent', tone: 'info', title: 'Waiting for their answer', detail: `Sent ${waiting === 0 ? 'today' : `${waiting} day${waiting === 1 ? '' : 's'} ago`}.` });
    }
  } else if (f.expiresAt && f.status === 'DRAFT') {
    const window = days(f.expiresAt.getTime() - from.getTime());
    signals.push({ id: 'deadline_window', tone: 'info', title: `${window} day${window === 1 ? '' : 's'} to respond`, detail: 'From today, if you send it now.' });
  }

  return { signals, notChecked: [...notChecked, ...NEVER_USED] };
}
