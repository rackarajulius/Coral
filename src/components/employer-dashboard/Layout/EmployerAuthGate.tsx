import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";
import { updateUserRole } from "@/lib/api/auth";
import { AccountCheckPending } from "@/components/auth/AccountCheckPending";

const Spinner = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

interface EmployerAuthGateProps {
  children: React.ReactNode;
}

/**
 * Gates the company dashboard routes:
 * - requires sign-in (shows the sign-up modal inline if not authenticated)
 * - auto-promotes a brand-new account to EMPLOYER on first visit
 * - lets anyone else in through a company seat, as on LinkedIn: a job seeker
 *   with a seat uses the dashboard from the account they already have, and one
 *   without a seat is taken to company setup, where they can create a company
 *   page or ask to join theirs
 * - keeps freelancer accounts out for now, with an explanation
 */
export function EmployerAuthGate({ children }: EmployerAuthGateProps) {
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [promoteState, setPromoteState] = useState<"idle" | "pending" | "error">("idle");
  const [retryToken, setRetryToken] = useState(0);
  // Signing in sets `isLoading` too. Swapping the sign-in window for the
  // spinner then unmounted it mid-attempt, so a "wrong password" message
  // vanished and the form reset. Once shown, it stays until they're in.
  const signInShown = useRef(false);

  const needsPromotion =
    isAuthenticated &&
    !!user &&
    // A placeholder role/status must never trigger a role change.
    !user.provisional &&
    user.role !== "EMPLOYER" &&
    user.role !== "ADMIN" &&
    user.status === "PENDING_ONBOARDING";

  useEffect(() => {
    if (!needsPromotion) return;

    let cancelled = false;
    setPromoteState("pending");

    (async () => {
      try {
        await updateUserRole("EMPLOYER");
        if (!cancelled) await refreshUser();
      } catch {
        if (!cancelled) setPromoteState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPromotion, retryToken]);

  if (isLoading && !signInShown.current) {
    return <Spinner />;
  }

  if (!isAuthenticated || !user) {
    signInShown.current = true;
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <AuthModal
          open
          initialView="signup"
          onClose={() => navigate("/employers")}
          // Stay on this page after auth succeeds — the gate re-renders once
          // AuthContext picks up the new session.
          onAuthenticated={() => {}}
        />
      </div>
    );
  }

  // Role and status are placeholders until the backend answers.
  if (user.provisional) {
    return <AccountCheckPending />;
  }

  if (user.role !== "EMPLOYER" && user.role !== "ADMIN") {
    if (user.status === "PENDING_ONBOARDING") {
      if (promoteState === "error") {
        return (
          <div className="min-h-screen bg-white flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
              <p className="text-foreground font-medium mb-2">Couldn't set up your employer account</p>
              <p className="text-sm text-muted-foreground mb-4">
                Something went wrong while preparing your dashboard. Please try again.
              </p>
              <button
                type="button"
                onClick={() => setRetryToken((t) => t + 1)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        );
      }
      return <Spinner />;
    }

    // One account: a seat is what lets someone act for a company.
    if (user.company) return <>{children}</>;

    // No seat yet. Company setup is where they create a company page, or ask
    // to join the one their work email belongs to — and it is the one
    // dashboard route they may open before they have a company.
    if (user.role === "JOB_SEEKER") {
      return location.pathname.startsWith("/employers/onboarding")
        ? <>{children}</>
        : <Navigate to="/employers/onboarding" replace />;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-foreground font-medium mb-2">Freelancer accounts can't run a company page yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Sign in with a different account to use the company dashboard.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/employers")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back to employers
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/employers");
              }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Employers who haven't finished setup go to onboarding first. The check
  // sits here rather than on each route so a new dashboard page can't
  // accidentally skip it — and it excludes the onboarding route itself, which
  // would otherwise redirect to itself forever.
  if (
    user.status === "PENDING_ONBOARDING" &&
    !location.pathname.startsWith("/employers/onboarding")
  ) {
    return <Navigate to="/employers/onboarding" replace />;
  }

  return <>{children}</>;
}

export default EmployerAuthGate;
