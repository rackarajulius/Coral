import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { resolvePostAuthPath } from "@/lib/postAuth";
import { oneTapSuppression } from "@/lib/oneTapSuppression";

/**
 * Google One Tap for signed-out visitors.
 *
 * Someone who has signed in with Google here before is signed back in without
 * a click (`auto_select`); anyone else sees Google's card and presses
 * Continue. A deliberate sign-out stops that until they sign in on purpose
 * again (see oneTapSuppression), so signing out is not undone by the next
 * page load.
 *
 * Loads Google Identity Services, initializes One Tap with a hashed nonce, and
 * on success exchanges the returned Google ID token for a Supabase session via
 * AuthContext.signInWithGoogleIdToken (which sets the session and fires
 * SIGNED_IN). Renders nothing — Google draws its own UI (top-right card).
 *
 * Requires:
 *  - VITE_GOOGLE_CLIENT_ID (Web OAuth client id)
 *  - that client's Authorized JavaScript origins include this app's origin
 *  - the same client id added to Supabase → Auth → Google → Authorized Client IDs
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Load the GIS script once, shared across mounts.
let gisLoader: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisLoader) return gisLoader;
  gisLoader = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoader;
}

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// Google One Tap + Supabase nonce handshake: the *hashed* nonce goes to Google
// (lands in the ID token), the *raw* nonce goes to Supabase to verify against it.
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const hashed = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return { raw, hashed };
}

export default function GoogleOneTap() {
  const { isAuthenticated, isLoading, signInWithGoogleIdToken, user } = useAuth();
  const { isOpen: isAuthModalOpen } = useAuthModal();
  const navigate = useNavigate();

  // Keep the latest exchange fn without making it an effect dependency
  // (it isn't memoized in the provider, so depending on it would re-run us).
  const exchangeRef = useRef(signInWithGoogleIdToken);
  exchangeRef.current = signInWithGoogleIdToken;

  // Set when a One Tap sign-in starts; the redirect effect consumes it once the
  // backend user (with real role) lands — no extra /auth/me round-trip.
  const pendingRedirect = useRef(false);

  // Redirect as soon as the signed-in user resolves (loaded by the SIGNED_IN
  // listener). A transient default role yields no path — we keep waiting and
  // only navigate/consume once a role with a destination arrives.
  useEffect(() => {
    if (!pendingRedirect.current || !user) return;
    const path = resolvePostAuthPath(user);
    if (path) {
      pendingRedirect.current = false;
      navigate(path);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!CLIENT_ID) return; // not configured — no-op
    // Only signed-out, resolved visitors — never alongside the auth modal
    // (which offers the explicit "Continue with Google" popup instead), and
    // never after a deliberate sign-out until they sign in on purpose again.
    if (isLoading || isAuthenticated || isAuthModalOpen) return;
    if (oneTapSuppression.isSuppressed()) return;

    let cancelled = false;

    (async () => {
      try {
        await loadGis();
        if (cancelled) return;

        const { raw, hashed } = await makeNonce();
        if (cancelled) return;

        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          // Returning visitors are signed in without a click; the
          // oneTapSuppression check above is what holds this back after a
          // deliberate sign-out.
          auto_select: true,
          cancel_on_tap_outside: true,
          itp_support: true,
          callback: async (response: { credential?: string }) => {
            if (!response?.credential) return;
            try {
              // Arm the redirect, then sign in. The SIGNED_IN listener loads the
              // backend user (real role) and the redirect effect navigates — no
              // second /auth/me fetch, so it's as snappy as the popup.
              pendingRedirect.current = true;
              await exchangeRef.current(response.credential, raw);
            } catch (err) {
              pendingRedirect.current = false;
              console.error("Google One Tap sign-in failed:", err);
            }
          },
        });

        // The callback surfaces *why* One Tap didn't show (origin not allowed,
        // FedCM/cookies blocked, cooldown after repeated dismissals, etc.).
        google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.()) {
            console.info("[GoogleOneTap] not displayed:", notification.getNotDisplayedReason?.());
          } else if (notification?.isSkippedMoment?.()) {
            console.info("[GoogleOneTap] skipped:", notification.getSkippedReason?.());
          }
        });
      } catch (err) {
        console.error("[GoogleOneTap]", err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        (window as any).google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [isAuthenticated, isLoading, isAuthModalOpen]);

  return null;
}
