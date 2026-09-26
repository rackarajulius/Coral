import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { AUTH_POPUP_TOKENS_KEY } from "@/hooks/useOAuthPopup";

/**
 * OAuth return page. Runs inside the popup opened by useOAuthPopup:
 * Supabase (detectSessionInUrl) exchanges the ?code for a session, then this
 * writes the session tokens to localStorage (shared same-origin) and closes.
 * The opener reads them the moment it sees the popup close.
 */
const AuthCallback = () => {
  useEffect(() => {
    let done = false;
    const complete = (session: Session | null) => {
      if (done) return;
      done = true;
      if (session) {
        try {
          localStorage.setItem(
            AUTH_POPUP_TOKENS_KEY,
            JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          );
        } catch {
          /* storage unavailable — opener falls back to its own session check */
        }
      }
      window.close();
    };

    // detectSessionInUrl processes the ?code asynchronously — wait for the session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) complete(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) complete(session);
    });
    // Safety net so the popup never hangs.
    const timeout = window.setTimeout(() => complete(null), 6000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  // Blank — the popup closes itself as soon as auth completes.
  return <div className="min-h-screen bg-white" />;
};

export default AuthCallback;
