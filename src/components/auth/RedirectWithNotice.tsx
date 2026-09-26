import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Sends someone elsewhere and says why, so a redirect never looks like a
 * broken link. The toast id stops a double effect from showing it twice.
 */
export function RedirectWithNotice({ to, message }: { to: string; message: string }) {
  useEffect(() => {
    toast.info(message, { id: message });
  }, [message]);
  return <Navigate to={to} replace />;
}

export default RedirectWithNotice;
