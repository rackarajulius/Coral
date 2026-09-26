/**
 * Persists the user's post-authentication intent across an OAuth redirect.
 *
 * Social sign-in navigates away to the provider and back, so in-memory state
 * (the AuthModal's onSuccess callback) is lost. We stash a serializable
 * "return to this path" + a flag marking that an OAuth round-trip is in flight,
 * then replay it once the app reloads authenticated.
 */
const RETURN_TO_KEY = "auth:returnTo";
const OAUTH_PENDING_KEY = "auth:oauthPending";

export const authIntent = {
  /** Store (or clear) the path to return to after auth. */
  setReturnTo(path: string | null) {
    try {
      if (path) sessionStorage.setItem(RETURN_TO_KEY, path);
      else sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {
      /* sessionStorage unavailable — degrade gracefully */
    }
  },
  getReturnTo(): string | null {
    try {
      return sessionStorage.getItem(RETURN_TO_KEY);
    } catch {
      return null;
    }
  },
  /** Mark that a social-auth redirect is in progress (set just before redirect). */
  markOAuthPending() {
    try {
      sessionStorage.setItem(OAUTH_PENDING_KEY, "1");
    } catch {
      /* noop */
    }
  },
  isOAuthPending(): boolean {
    try {
      return sessionStorage.getItem(OAUTH_PENDING_KEY) === "1";
    } catch {
      return false;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(RETURN_TO_KEY);
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
    } catch {
      /* noop */
    }
  },
};
