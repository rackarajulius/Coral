import assert from "node:assert/strict";
import test from "node:test";
import { REFRESH_MARGIN_MS, shareSession, type AuthLike, type SessionLike } from "./sharedSession.ts";

const NOW = 1_800_000_000_000;
const inAnHour = (token: string): SessionLike => ({ access_token: token, expires_at: (NOW + 3600_000) / 1000 });

/** A stand-in for `supabase.auth`: counts lookups, and lets a test fire its events. */
function fakeAuth(lookups: Array<() => Promise<{ data: { session: SessionLike | null }; error: unknown }>>) {
  let emit: (event: string, session: SessionLike | null) => void = () => {};
  const auth: AuthLike<SessionLike> & { calls: number } = {
    calls: 0,
    getSession() {
      const next = lookups[Math.min(this.calls, lookups.length - 1)];
      this.calls += 1;
      return next();
    },
    onAuthStateChange(callback) {
      emit = callback;
      return {};
    },
  };
  shareSession(auth, () => NOW);
  return { auth, emit: (event: string, session: SessionLike | null) => emit(event, session) };
}

const answer = (session: SessionLike | null) => () => Promise.resolve({ data: { session }, error: null });

test("before Supabase has said anything, many requests share one lookup", async () => {
  const { auth } = fakeAuth([answer(inAnHour("a"))]);
  const results = await Promise.all(Array.from({ length: 10 }, () => auth.getSession()));
  assert.equal(auth.calls, 1);
  assert.ok(results.every((r) => r.data.session?.access_token === "a"));
});

test("once the session is known, requests don't touch the lock at all", async () => {
  const { auth, emit } = fakeAuth([answer(null)]);
  emit("INITIAL_SESSION", inAnHour("b"));
  await Promise.all(Array.from({ length: 20 }, () => auth.getSession()));
  assert.equal(auth.calls, 0);
  assert.equal((await auth.getSession()).data.session?.access_token, "b");
});

test("signed out is known too: a visitor's requests go without a lookup", async () => {
  const { auth, emit } = fakeAuth([answer(null)]);
  emit("INITIAL_SESSION", null);
  assert.equal((await auth.getSession()).data.session, null);
  assert.equal(auth.calls, 0);
});

test("a refreshed token or a sign-out takes over at once", async () => {
  const { auth, emit } = fakeAuth([answer(null)]);
  emit("SIGNED_IN", inAnHour("old"));
  emit("TOKEN_REFRESHED", inAnHour("new"));
  assert.equal((await auth.getSession()).data.session?.access_token, "new");
  emit("SIGNED_OUT", null);
  assert.equal((await auth.getSession()).data.session, null);
  assert.equal(auth.calls, 0);
});

test("a token about to run out is looked up again — once — so Supabase refreshes it", async () => {
  const { auth, emit } = fakeAuth([answer(inAnHour("refreshed"))]);
  emit("INITIAL_SESSION", { access_token: "stale", expires_at: (NOW + REFRESH_MARGIN_MS - 1000) / 1000 });
  const results = await Promise.all([auth.getSession(), auth.getSession(), auth.getSession()]);
  assert.equal(auth.calls, 1);
  assert.ok(results.every((r) => r.data.session?.access_token === "refreshed"));
  await auth.getSession();
  assert.equal(auth.calls, 1);
});

test("a lookup that lost the lock to a stall is tried once more, not failed", async () => {
  const theft = Object.assign(new Error('Lock "lock:sb-x-auth-token" was released because another request stole it'), {
    name: "NavigatorLockAcquireTimeoutError",
  });
  const { auth } = fakeAuth([() => Promise.reject(theft), answer(inAnHour("c"))]);
  assert.equal((await auth.getSession()).data.session?.access_token, "c");
  assert.equal(auth.calls, 2);
});

test("an error is passed on and not remembered", async () => {
  const { auth } = fakeAuth([
    () => Promise.resolve({ data: { session: null }, error: new Error("network") }),
    answer(inAnHour("d")),
  ]);
  assert.ok((await auth.getSession()).error);
  assert.equal((await auth.getSession()).data.session?.access_token, "d");
  assert.equal(auth.calls, 2);
});

test("any other failure is not retried", async () => {
  const { auth } = fakeAuth([() => Promise.reject(new Error("boom")), answer(inAnHour("e"))]);
  await assert.rejects(auth.getSession(), /boom/);
  assert.equal(auth.calls, 1);
});
