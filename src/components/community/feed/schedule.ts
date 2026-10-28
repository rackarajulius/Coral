/**
 * Times for scheduled company posts, as a `datetime-local` input wants them.
 *
 * The input works in the reader's own clock, with no zone in its value; the
 * server is sent an ISO instant. The limits match the server's: at least ten
 * minutes ahead, at most ninety days.
 */

export const SCHEDULE_MIN_MS = 10 * 60_000;
export const SCHEDULE_MAX_MS = 90 * 24 * 60 * 60_000;

/** "2026-11-03T09:00" in local time. */
export function toLocalInput(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** An hour from now, on the next quarter hour: a time people actually pick. */
export function defaultScheduleTime(now = Date.now()): string {
  const quarter = 15 * 60_000;
  return toLocalInput(new Date(Math.ceil((now + 60 * 60_000) / quarter) * quarter));
}

/** Why a picked time would be refused, or null when it is fine. */
export function scheduleProblem(value: string, now = Date.now()): string | null {
  const at = new Date(value).getTime();
  if (!value || Number.isNaN(at)) return "Choose a date and time.";
  if (at < now + SCHEDULE_MIN_MS) return "At least 10 minutes from now.";
  if (at > now + SCHEDULE_MAX_MS) return "No more than 90 days ahead.";
  return null;
}

/** "Tue, Nov 3, 9:00 AM", in the reader's clock. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** The reader's time zone, to say which clock the picker is in. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "your time zone";
  }
}
