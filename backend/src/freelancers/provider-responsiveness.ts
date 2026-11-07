/**
 * How a provider replies to requests for their services, as Coral measured
 * it. Explainable facts, never a score:
 *
 * - **Measured, never estimated.** Time to reply runs from the request to
 *   `recipientRespondedAt`, written once when they first accept, decline or
 *   reply. A request without that time can still count as answered (an old
 *   decline) but is never given a time.
 * - **The client's own actions never count.** Withdrawn requests are left
 *   out of both sides, so clients giving up cannot flatter a silent provider
 *   or count against one. Blocked requests are left out too: a block is for
 *   abuse, and spam is not a client waiting for an answer.
 * - **No penalty for new requests.** An unanswered request counts against
 *   them only once it is a week old.
 * - **Silence below a minimum.** Nothing is said publicly until enough
 *   requests count, and "usually within" needs enough timed answers of its
 *   own. The provider sees how close they are.
 */

/** Requests that must count before anything is said publicly. */
export const MIN_REQUESTS = 5;
/** Timed answers needed before saying how quickly they usually reply. */
export const MIN_TIMED = 5;
/** How old an unanswered request must be before it counts against them. */
export const GRACE_DAYS = 7;
/** How far back requests are counted. */
export const WINDOW_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Requests ended by the client, or presumed abusive: never counted. */
export const UNCOUNTED_STATUSES = ['withdrawn', 'blocked'];
/** Statuses only an answer from the provider reaches. */
const ANSWERED_STATUSES = ['accepted', 'declined'];

export interface ProviderResponsiveness {
  /** Whether there is enough to say anything at all. */
  available: boolean;
  /** Requests that count: answered, or a week old without an answer. */
  considered: number;
  /** Of those, how many they answered. */
  replied: number;
  /** Median hours from request to first answer; null until MIN_TIMED answers are timed. */
  medianHoursToReply: number | null;
  /** The minimum `considered` must reach. */
  needed: number;
}

export interface RequestTiming {
  status: string;
  createdAt: Date;
  recipientRespondedAt: Date | null;
}

export function measureResponsiveness(requests: RequestTiming[], now: Date = new Date()): ProviderResponsiveness {
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const graceEnds = now.getTime() - GRACE_DAYS * DAY_MS;
  let considered = 0;
  let replied = 0;
  const hours: number[] = [];

  for (const request of requests) {
    if (UNCOUNTED_STATUSES.includes(request.status) || request.createdAt.getTime() < since) continue;
    const answered = !!request.recipientRespondedAt || ANSWERED_STATUSES.includes(request.status);
    if (!answered && request.createdAt.getTime() > graceEnds) continue;
    considered++;
    if (!answered) continue;
    replied++;
    if (request.recipientRespondedAt) {
      hours.push(Math.max(0, request.recipientRespondedAt.getTime() - request.createdAt.getTime()) / HOUR_MS);
    }
  }

  return {
    available: considered >= MIN_REQUESTS,
    considered,
    replied,
    medianHoursToReply: hours.length >= MIN_TIMED ? Math.round(median(hours) * 10) / 10 : null,
    needed: MIN_REQUESTS,
  };
}

/** The middle value: one request left for months cannot move it. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
