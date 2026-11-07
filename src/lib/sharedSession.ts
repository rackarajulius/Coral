/**
 * One session for the whole page, instead of one lookup per request.
 *
 * Every API call here starts with `supabase.auth.getSession()` (93 of them,
 * in 66 files). Each of those takes the same browser lock. On a slow page —
 * a phone on a weak connection, a tab coming back from sleep — they queue
 * behind it, and once one has waited ten seconds Supabase "steals" the lock
 * and every other waiter fails at once with "Lock … was released because
 * another request stole it". The feed then says it couldn't load.
 *
 * So the session is remembered, kept current by Supabase's own sign-in,
 * refresh and sign-out events, and handed out without touching the lock.
 * Supabase is asked only when nothing is known yet or the token is about to
 * run out — and then once, however many requests are waiting.
 */

/** As much of a Supabase session as this reads. */
export interface SessionLike {
  access_token: string;
  /** Seconds since 1970, as Supabase sends it. */
  expires_at?: number;
}

export interface SessionResult<S extends SessionLike> {
  data: { session: S | null };
  error: unknown;
}

/** As much of `supabase.auth` as this needs. */
export interface AuthLike<S extends SessionLike> {
  getSession(): Promise<SessionResult<S>>;
  onAuthStateChange(callback: (event: string, session: S | null) => void): unknown;
}

/** Asked for again this long before the token runs out, so a request never leaves with a dead one. */
export const REFRESH_MARGIN_MS = 60_000;

const isLockTheft = (err: unknown) =>
  err instanceof Error && (err.name === 'NavigatorLockAcquireTimeoutError' || /lock/i.test(err.message) && /stole|timed? ?out/i.test(err.message));

/**
 * Replaces `auth.getSession` with the shared version. Call once, right after
 * the client is made, before anything asks.
 */
export function shareSession<S extends SessionLike>(auth: AuthLike<S>, now: () => number = Date.now): void {
  const original = auth.getSession.bind(auth);
  let known = false;
  let current: S | null = null;
  let inFlight: Promise<SessionResult<S>> | null = null;

  // Signing in, a refreshed token, signing out — in this tab or another.
  // Only remembered here: calling Supabase from inside this callback is
  // what its docs warn deadlocks.
  auth.onAuthStateChange((_event, session) => {
    current = session;
    known = true;
  });

  const fresh = (session: S) => !session.expires_at || session.expires_at * 1000 - now() > REFRESH_MARGIN_MS;

  const lookUp = async (): Promise<SessionResult<S>> => {
    let result: SessionResult<S>;
    try {
      result = await original();
    } catch (err) {
      // Lost the lock to a stall; asked once more, which now has it alone.
      if (!isLockTheft(err)) throw err;
      result = await original();
    }
    if (!result.error) {
      current = result.data.session;
      known = true;
    }
    return result;
  };

  auth.getSession = () => {
    if (known && (current === null || fresh(current))) {
      return Promise.resolve({ data: { session: current }, error: null });
    }
    inFlight ??= lookUp().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
