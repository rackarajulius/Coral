import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

/**
 * Route guard for authenticated-only pages. Instead of bouncing to a /login
 * page, it opens the global auth modal and sends the visitor home behind it;
 * on a successful sign-in they're returned to the page they originally wanted.
 *
 * Usage:  <Route element={<RequireAuth />}> ...protected routes... </Route>
 */
const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const location = useLocation();
  const prompted = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || prompted.current) return;
    prompted.current = true;
    // redirectTo survives both email auth and the OAuth round-trip, returning
    // the user to the originally requested route after signing in.
    openAuth({
      view: "social",
      redirectTo: location.pathname + location.search,
    });
  }, [isLoading, isAuthenticated, openAuth, location]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
};

export default RequireAuth;
