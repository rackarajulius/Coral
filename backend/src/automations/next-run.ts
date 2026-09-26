import { TaskCadence } from '@prisma/client';

/**
 * Scheduling in the user's own timezone, using only `Intl`.
 *
 * No date library is installed, and adding one for this would be heavy. Node's
 * `Intl` already knows every IANA zone, which is enough: format an instant *in*
 * the zone, compare it to the same wall-clock read as UTC, and the difference
 * is that zone's offset at that instant.
 */

/** The zone's offset from UTC, in ms, at a given instant. */
function offsetMsAt(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    // Intl renders midnight as 24 in some locales with hour12:false.
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asIfUtc - utcMs;
}

/** The instant at which the wall clock in `timeZone` reads the given local time. */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  const firstGuess = naive - offsetMsAt(naive, timeZone);
  // The offset is sampled at the wrong instant on a DST boundary, so re-sample
  // at the corrected one. Two passes converge for every real zone.
  const corrected = naive - offsetMsAt(firstGuess, timeZone);
  return new Date(corrected);
}

/** Calendar fields as they read in `timeZone` at a given instant. */
function partsIn(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    weekday: ((weekdays.indexOf(get('weekday')) + 6) % 7) + 1,
  };
}

/** True when a task with this cadence may fire on the given ISO weekday. */
function fitsCadence(cadence: TaskCadence, weekday: number, wanted: number | null): boolean {
  if (cadence === TaskCadence.DAILY) return true;
  if (cadence === TaskCadence.WEEKDAYS) return weekday >= 1 && weekday <= 5;
  return weekday === (wanted ?? 1);
}

/**
 * The next instant this task should run, strictly after `from`.
 *
 * Walks forward a day at a time in the task's own zone rather than adding fixed
 * 24h steps — across a DST change a day is not 24 hours, and fixed arithmetic
 * drifts an 09:00 task to 08:00 or 10:00 and keeps it there.
 *
 * An unknown zone falls back to UTC rather than throwing: a task that runs at
 * the wrong hour is recoverable, one that cannot be saved is not.
 */
export function computeNextRun(
  task: { cadence: TaskCadence; hourLocal: number; weekday: number | null; timezone: string },
  from: Date = new Date(),
): Date {
  const timeZone = isValidZone(task.timezone) ? task.timezone : 'UTC';
  const hour = Math.min(Math.max(task.hourLocal, 0), 23);

  const start = partsIn(timeZone, from);
  // 14 days is comfortably past any weekly cadence plus a DST shift.
  for (let i = 0; i <= 14; i++) {
    const probe = new Date(Date.UTC(start.year, start.month - 1, start.day + i, 12, 0, 0));
    const local = partsIn(timeZone, probe);
    if (!fitsCadence(task.cadence, local.weekday, task.weekday)) continue;

    const candidate = zonedToUtc(local.year, local.month, local.day, hour, timeZone);
    if (candidate.getTime() > from.getTime()) return candidate;
  }

  // Unreachable for the cadences above; keeps the return type honest.
  return new Date(from.getTime() + 86_400_000);
}

export function isValidZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** One-line description of the cadence, e.g. "Weekdays at 08:00". */
export function describeCadence(task: {
  cadence: TaskCadence;
  hourLocal: number;
  weekday: number | null;
}): string {
  const time = `${String(task.hourLocal).padStart(2, '0')}:00`;
  if (task.cadence === TaskCadence.DAILY) return `Every day at ${time}`;
  if (task.cadence === TaskCadence.WEEKDAYS) return `Weekdays at ${time}`;
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return `Every ${names[(task.weekday ?? 1) - 1]} at ${time}`;
}
