import { useCallback } from "react";
import supabase from "@/lib/supabase";

/**
 * localStorage key the /auth/callback popup writes its session tokens to before
 * closing. Shared same-origin storage is synchronous and unaffected by COOP,
 * BroadcastChannel timing, or cross-window session-sync delays — so the opener
 * can read it the moment it sees the popup close.
 */
export const AUTH_POPUP_TOKENS_KEY = "auth:popup-tokens";

/** Providers that support the popup flow. */
export type PopupProvider = "google" | "facebook";

/**
 * "success" — signed in. "dismissed" — user closed the popup (do nothing).
 * "blocked" — the popup couldn't open (fall back to the full redirect).
 */
export type PopupResult = "success" | "dismissed" | "blocked";

function centeredPopupFeatures(): string {
  const w = 478;
  const h = 650;
  // Center over the current browser window using its on-screen position, so it
  // lands on whichever monitor the app is on (dual-monitor safe). The window-
  // relative Math.max keeps it inside the window instead of clamping to the
  // primary monitor's origin.
  const screenX = window.screenX ?? window.screenLeft ?? 0;
  const screenY = window.screenY ?? window.screenTop ?? 0;
  const outerWidth = window.outerWidth || window.innerWidth || w;
  const outerHeight = window.outerHeight || window.innerHeight || h;
  const left = Math.round(screenX + Math.max(0, (outerWidth - w) / 2));
  const top = Math.round(screenY + Math.max(0, (outerHeight - h) / 2));
  return `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
}

/**
 * OAuth sign-in via a popup window (no full-page redirect on the main tab).
 *
 * Asks Supabase for the provider's OAuth URL (skipBrowserRedirect), opens it in
 * a popup where the user authorizes, and completes on the /auth/callback page.
 * The callback writes the session tokens to localStorage; when this window sees
 * them it calls setSession() to sign in here. Reuses the existing Supabase
 * provider config — no extra client IDs needed.
 */
export function useOAuthPopup() {
  const signIn = useCallback(
    async (provider: PopupProvider, opts?: { loginHint?: string }): Promise<PopupResult> => {
      // Clear any stale handoff, then open synchronously (inside the click
      // gesture) so it isn't popup-blocked.
      localStorage.removeItem(AUTH_POPUP_TOKENS_KEY);
      const popup = window.open("about:blank", `${provider}-oauth`, centeredPopupFeatures());
      if (!popup) return "blocked";

      // Google supports an account chooser: with a login_hint ("Continue as X")
      // go straight into that account; without one, force the chooser. Facebook
      // has no equivalent — its own dialog shows "Continue as <name>" natively.
      const queryParams: Record<string, string> | undefined =
        provider === "google"
          ? opts?.loginHint
            ? { login_hint: opts.loginHint }
            : { prompt: "select_account" }
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: `${window.location.origin}/auth/callback`,
          ...(provider === "facebook" ? { scopes: "email,public_profile" } : {}),
          ...(queryParams ? { queryParams } : {}),
        },
      });

      if (error || !data?.url) {
        popup.close();
        return "blocked";
      }
      popup.location.href = data.url;

      return new Promise<PopupResult>((resolve) => {
        let settled = false;

        // Fast path: if the session happens to sync on its own.
        const sub = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") finish("success");
        });

        // Watch only for the tokens the popup writes on success. We do NOT read
        // popup.closed — under COOP the severed reference reports closed===true
        // while the popup is still working, which would falsely resolve
        // "dismissed" before sign-in completes. Cancel falls to the timeout.
        const poll = window.setInterval(async () => {
          const raw = localStorage.getItem(AUTH_POPUP_TOKENS_KEY);
          if (!raw) return;
          window.clearInterval(poll);
          localStorage.removeItem(AUTH_POPUP_TOKENS_KEY);
          try {
            const { access_token, refresh_token } = JSON.parse(raw);
            await supabase.auth.setSession({ access_token, refresh_token });
            finish("success");
          } catch {
            finish("dismissed");
          }
        }, 400);

        // Hard cap so a cancelled popup (no tokens, no SIGNED_IN) can't spin forever.
        const timeout = window.setTimeout(() => finish("dismissed"), 90000);

        function finish(result: PopupResult) {
          if (settled) return;
          settled = true;
          sub.data.subscription.unsubscribe();
          window.clearInterval(poll);
          window.clearTimeout(timeout);
          try {
            popup.close();
          } catch {
            /* cross-origin while still on the provider — ignore */
          }
          resolve(result);
        }
      });
    },
    [],
  );

  return { signIn };
}
