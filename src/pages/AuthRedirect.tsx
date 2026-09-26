import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal, AuthView } from "@/contexts/AuthModalContext";

interface AuthRedirectProps {
  view: AuthView;
}

/**
 * Thin compatibility wrapper for the legacy /login and /signup URLs (bookmarks,
 * old emails, deep links). There is no standalone auth page anymore — the global
 * AuthModal is the single source of truth — so these routes simply open it over
 * the home page. Already-signed-in visitors are sent straight home.
 */
const AuthRedirect = ({ view }: AuthRedirectProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const opened = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !opened.current) {
      opened.current = true;
      openAuth({ view });
    }
  }, [isLoading, isAuthenticated, openAuth, view]);

  if (isLoading) return null;
  return <Navigate to="/" replace />;
};

export default AuthRedirect;
