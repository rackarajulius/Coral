/**
 * Remembers the last account a user signed in with via Google, so the auth
 * modal can offer a personalized "Continue as {name}" button (like Google's
 * One Tap card) for returning visitors.
 *
 * Unlike the `auth:user` session cache, this deliberately SURVIVES sign-out —
 * a signed-out returning visitor should still see who they last used. It holds
 * only display data (name/email/avatar), never tokens.
 */
const KEY = "auth:lastGoogleAccount";

export interface LastGoogleAccount {
  name: string;
  email: string;
  avatarUrl: string | null;
}

export const lastGoogleAccount = {
  get(): LastGoogleAccount | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as LastGoogleAccount) : null;
    } catch {
      return null;
    }
  },
  set(account: LastGoogleAccount) {
    try {
      localStorage.setItem(KEY, JSON.stringify(account));
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
