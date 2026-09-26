/**
 * What has to happen around a sign-out, registered by whoever owns the state.
 *
 * Sign-out used to clear the cached user and the session and nothing else.
 * The profile stayed in memory and on disk, the query cache kept every
 * response, and — because signing back in never reloads the page — the next
 * person to sign in on that tab saw the previous person's profile, and their
 * first edit saved it into their own account.
 *
 * AuthProvider sits outside ProfileProvider and the query client, so it cannot
 * reach their state directly. They register here instead:
 *
 * - **before** — runs while the session is still valid. For work that needs
 *   it, like saving an edit made a moment ago.
 * - **after** — runs once the session is gone, however it went: a deliberate
 *   sign-out or an expired one. For forgetting.
 *
 * Every hook is isolated: one failing never stops the rest. A sign-out that
 * half-completes is the exact failure this exists to prevent.
 */
type Hook = () => void | Promise<void>;

const before = new Set<Hook>();
const after = new Set<Hook>();

/** Returns an unregister function, for use as an effect cleanup. */
export function onBeforeSignOut(hook: Hook): () => void {
  before.add(hook);
  return () => before.delete(hook);
}

export function onAfterSignOut(hook: Hook): () => void {
  after.add(hook);
  return () => after.delete(hook);
}

async function runAll(hooks: Set<Hook>, phase: string): Promise<void> {
  await Promise.all(
    Array.from(hooks).map(async (hook) => {
      try {
        await hook();
      } catch (error) {
        console.error(`Sign-out ${phase} hook failed:`, error);
      }
    }),
  );
}

export const runBeforeSignOut = () => runAll(before, 'before');
export const runAfterSignOut = () => runAll(after, 'after');
