import { useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { accountSide } from '@/lib/accountSide';

/**
 * Route guard for a person's own pages — profile, saved jobs, applications.
 *
 * - Everyone has these, employer accounts included: one account does
 *   everything, as on LinkedIn. An employer's personal profile starts hidden
 *   from candidate search until they choose otherwise.
 * - A new account that hasn't finished onboarding is sent to /onboarding —
 *   only once the backend has said so. A placeholder status (backend slow or
 *   briefly unreachable) used to send finished users back through onboarding.
 *   An employer account still setting up its company is not: that setup is
 *   the company's, not this form's.
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

  if (isAuthenticated && accountSide(user) === 'provider') {
    return <Navigate to="/provider" replace />;
  }

  if (isAuthenticated && accountSide(user) === 'undecided') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

export default OnboardingGate;
