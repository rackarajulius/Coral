import { useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RedirectWithNotice } from '@/components/auth/RedirectWithNotice';
import { EMPLOYER_ON_SEEKER_SIDE, accountSide } from '@/lib/accountSide';

/**
 * Route guard for the job-seeker's own pages.
 *
 * - Employer accounts are sent to their dashboard: these pages, and the API
 *   behind them, are for job seekers only.
 * - Signed-in users who haven't finished onboarding are sent to /onboarding —
 *   only once the backend has said so. A placeholder status (backend slow or
 *   briefly unreachable) used to send finished users back through onboarding.
 * - Signed-out visitors arriving fresh pass through, as before — several of
 *   these pages are browsable without an account.
 * - **A session that ends while you are on one of these pages sends you home.**
 *
 * That last rule is what makes signing out consistent. The profile sidebar and
 * the settings page navigated away themselves, but the header dropdown only
 * called `logout()`, so signing out from there left you looking at your own
 * profile page — signed out. Handling it here, rather than adding a redirect
 * to each dropdown, covers every way a session can end: any sign-out button,
 * an expired token, or signing out in another tab.
 */
const OnboardingGate = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Whether this visit has had a session at some point. Tracked per mount, so
  // someone who opens these pages signed out is never bounced.
  const wasSignedIn = useRef(false);
  if (isAuthenticated) wasSignedIn.current = true;

  if (isLoading) return null;

  if (wasSignedIn.current && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && accountSide(user) === 'employer') {
    return <RedirectWithNotice to="/employers/dashboard" message={EMPLOYER_ON_SEEKER_SIDE} />;
  }

  if (isAuthenticated && user?.status === 'PENDING_ONBOARDING' && !user.provisional) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

export default OnboardingGate;
