/**
 * When an outreach message should arrive.
 *
 * A rule, not a model — there is no outreach history to learn from yet, and a
 * recruiter should be able to read why a time was suggested. The rule is the
 * candidate's own working hours: Monday to Friday, 09:00–17:00 in *their*
 * timezone. A message written at 23:00 by a recruiter in Toronto lands at 17:00
 * in Kampala, which is the end of someone's day, not the start of it.
 *
 * Public holidays are not known and not guessed at.
 *
 * The timezone is the one the candidate's own browser reported while they used
 * Coral. Without one there is no suggestion — the recruiter's own clock would be
 * a guess dressed up as advice.
 */

export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 17;
/** Suggestions never reach further than this. */
const SEARCH_DAYS = 8;
/** Every UTC offset in use is a multiple of 15 minutes, so this finds local 09:00 exactly. */
const STEP_MS = 15 * 60_000;

export interface LocalMoment {
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  hour: number;
  minute: number;
  /** "Tue 21:40", in the candidate's zone. */
  label: string;
}

export function isValidTimezone(zone: string | null | undefined): zone is string {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localMoment(at: Date, zone: string): LocalMoment {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    hour,
    minute,
    label: `${parts.weekday} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function inWorkingHours(m: LocalMoment): boolean {
  return m.weekday >= 1 && m.weekday <= 5 && m.hour >= WORK_START_HOUR && m.hour < WORK_END_HOUR;
}

export interface TimingAdvice {
  /** False when the candidate's timezone is unknown — then nothing else is set. */
  known: boolean;
  timezone: string | null;
  /** Their local time now. */
  localNow: string | null;
  /** True when now is inside their working hours. */
  goodNow: boolean;
  /** The next start of their working day, when now is not a good time. */
  suggestedAt: string | null;
  /** That moment in their local time, e.g. "Wed 09:00". */
  suggestedLocal: string | null;
  /** One sentence the dialog can show as written. */
  reason: string;
}

/** Working-hours advice for a candidate in `zone`, as of `now`. */
export function adviseTiming(zone: string | null | undefined, now = new Date()): TimingAdvice {
  if (!isValidTimezone(zone)) {
    return {
      known: false,
      timezone: null,
      localNow: null,
      goodNow: false,
      suggestedAt: null,
      suggestedLocal: null,
      reason: "We don't know their timezone yet — it's recorded once they next use Coral.",
    };
  }

  const current = localMoment(now, zone);
  if (inWorkingHours(current)) {
    return {
      known: true,
      timezone: zone,
      localNow: current.label,
      goodNow: true,
      suggestedAt: null,
      suggestedLocal: null,
      reason: `It's ${current.label} for them — within their working hours.`,
    };
  }

  // Walk forward to the next local 09:00 on a weekday. Stepping, rather than
  // doing date arithmetic, is what keeps daylight-saving changes honest.
  const start = Math.ceil(now.getTime() / STEP_MS) * STEP_MS;
  for (let t = start; t < now.getTime() + SEARCH_DAYS * 86_400_000; t += STEP_MS) {
    const m = localMoment(new Date(t), zone);
    if (m.weekday >= 1 && m.weekday <= 5 && m.hour === WORK_START_HOUR && m.minute === 0) {
      return {
        known: true,
        timezone: zone,
        localNow: current.label,
        goodNow: false,
        suggestedAt: new Date(t).toISOString(),
        suggestedLocal: m.label,
        reason: `It's ${current.label} for them — outside working hours. Their next working morning is ${m.label}.`,
      };
    }
  }

  return {
    known: true,
    timezone: zone,
    localNow: current.label,
    goodNow: false,
    suggestedAt: null,
    suggestedLocal: null,
    reason: `It's ${current.label} for them — outside working hours.`,
  };
}
