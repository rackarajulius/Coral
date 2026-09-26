/**
 * Holds back Google's automatic sign-in after a deliberate sign-out.
 *
 * One Tap signs a returning visitor in without a click (`auto_select`), which
 * is what makes coming back effortless — and what would make signing out look
 * broken, since the next page load would sign them straight back in. So a
 * deliberate sign-out sets this flag, and only signing in again on purpose
 * (any method) clears it.
 *
 * In localStorage, not sessionStorage: a flag that died with the tab would let
 * a new tab, or reopening the browser, sign the person back in — exactly what
 * they just asked not to happen. Google's own `disableAutoSelect()` is called
 * at sign-out too; this flag is ours, so the prompt stays away even if
 * Google's state is lost.
 */
const KEY = "oneTap:suppressed";

export const oneTapSuppression = {
  /** Called on a deliberate sign-out. Also tells Google to stop auto-selecting. */
  suppress() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable — degrade gracefully */
    }
    try {
      // Google's own safeguard: without it, its automatic sign-in can fire
      // again on the next page even though we are not prompting.
      (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } })
        .google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* GIS not loaded — nothing to disable */
    }
  },
  isSuppressed(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },
  /** Called when someone signs in on purpose, so the prompt works again later. */
  clear() {
    try {
      localStorage.removeItem(KEY);
      // Older builds kept this in sessionStorage; drop any leftover.
      sessionStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
};
