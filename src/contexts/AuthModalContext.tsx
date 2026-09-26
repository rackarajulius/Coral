import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { authIntent } from "@/lib/authIntent";
import { resolvePostAuthPath } from "@/lib/postAuth";
import AuthModal from "@/components/AuthModal";

export type AuthView = "social" | "signup" | "forgot";

interface OpenAuthOptions {
  /** Which screen to land on. Defaults to the social/choose screen. */
  view?: AuthView;
  /** Runs once after a successful sign-in/sign-up completed inside the modal. */
  onSuccess?: () => void;
  /**
   * Serializable path to navigate to after auth. Unlike `onSuccess`, this
   * survives an OAuth redirect (persisted to sessionStorage and replayed on
   * return). Use it when the post-auth intent is "go to this route".
   */
  redirectTo?: string;
}

interface AuthModalContextType {
  isOpen: boolean;
  openAuth: (opts?: OpenAuthOptions) => void;
  closeAuth: () => void;
  /**
   * If the user is signed in, runs `action` immediately. Otherwise opens the
   * auth modal and runs `action` after they authenticate. The single primitive
   * that replaces every `navigate('/login')` across the app.
   */
  requireAuth: (action: () => void, opts?: { view?: AuthView }) => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("social");
  // Held in a ref so re-renders don't drop the pending post-auth action.
  const onSuccessRef = useRef<(() => void) | null>(null);
  // State (not a ref) so flipping it re-runs the redirect effect against the
  // current user — otherwise SIGNED_IN can set `user` before this is set,
  // leaving no later change to trigger the redirect.
  const [redirectPending, setRedirectPending] = useState(false);

  const openAuth = useCallback((opts?: OpenAuthOptions) => {
    setView(opts?.view ?? "social");
    onSuccessRef.current = opts?.onSuccess ?? null;
    // Persist an explicit return path so it survives an OAuth redirect. Plain
    // sign-in passes none, which clears any stale intent.
    authIntent.setReturnTo(opts?.redirectTo ?? null);
    setIsOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    onSuccessRef.current = null;
    authIntent.clear();
    setIsOpen(false);
  }, []);

  const requireAuth = useCallback(
    (action: () => void, opts?: { view?: AuthView }) => {
      if (isAuthenticated) {
        action();
        return;
      }
      // Default the OAuth return path to the current page so social sign-in
      // brings the user back here (the in-memory action can't cross OAuth).
      openAuth({
        view: opts?.view ?? "social",
        onSuccess: action,
        redirectTo: window.location.pathname + window.location.search,
      });
    },
    [isAuthenticated, openAuth],
  );

  // AuthModal calls this on a successful in-modal auth (email/password or
  // signup without email confirmation). It does not fire for OAuth, which
  // redirects away and back — that case is handled by the load-time effect.
  const handleAuthenticated = useCallback(() => {
    const cb = onSuccessRef.current;
    onSuccessRef.current = null;
    setIsOpen(false);
    if (cb) {
      authIntent.clear();
      cb();
      return;
    }
    const returnTo = authIntent.getReturnTo();
    authIntent.clear();
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    // Plain sign-in: defer the redirect until the role resolves (the backend
    // user, with role, arrives asynchronously after sign-in).
    setRedirectPending(true);
  }, [navigate]);

  useEffect(() => {
    if (!redirectPending || !user) return;
    setRedirectPending(false);
    const path = resolvePostAuthPath(user);
    if (path) navigate(path);
  }, [redirectPending, user, navigate]);

  // OAuth round-trip: the provider mounts fresh after the redirect. Once the
  // user resolves, replay the stored intent (explicit return path, else the
  // role-based default) exactly once.
  useEffect(() => {
    if (!user || !authIntent.isOAuthPending()) return;
    const returnTo = authIntent.getReturnTo();
    authIntent.clear();
    const path = returnTo ?? resolvePostAuthPath(user);
    if (path) navigate(path);
  }, [user, navigate]);

  const value = useMemo<AuthModalContextType>(
    () => ({ isOpen, openAuth, closeAuth, requireAuth }),
    [isOpen, openAuth, closeAuth, requireAuth],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        open={isOpen}
        initialView={view}
        onClose={closeAuth}
        onAuthenticated={handleAuthenticated}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within an AuthModalProvider");
  return ctx;
}

export default AuthModalContext;
