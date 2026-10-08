import { Navigate, useLocation } from "react-router-dom";

/**
 * Sends an old path to its new one, carrying the query string and hash.
 *
 * `<Navigate to="/new" />` drops them, which matters more than it looks:
 * notification rows in the database hold links like
 * `/employers/messages?c=<conversationId>`, and that parameter is the whole
 * reason the link opens the right thread rather than an empty inbox. Those rows
 * were written before the rename and nothing rewrites them, so this redirect is
 * permanent rather than a migration aid.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export default LegacyRedirect;
