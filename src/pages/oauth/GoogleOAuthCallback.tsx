import { useEffect } from "react";

/**
 * OAuth landing route (`/oauth/google?status=connected|error`). The backend
 * callback redirects the browser here after Google consent.
 *
 * - In a popup: posts the result back to the opener and closes itself.
 * - Full-page fallback (popup was blocked): forwards to the Candidates board,
 *   where the `?google=` handler shows a toast.
 */
const GoogleOAuthCallback = () => {
  const status = new URLSearchParams(window.location.search).get("status") ?? "error";

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (opener && opener !== window) {
      opener.postMessage({ source: "google-oauth", status }, window.location.origin);
      window.close();
      return;
    }
    // Not a popup — forward to the board so the existing toast fires.
    window.location.replace(`/employers/candidates?google=${status === "connected" ? "connected" : "error"}`);
  }, [status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {status === "connected" ? "Google Calendar connected." : "Couldn't connect Google Calendar."}
        <br />
        You can close this window.
      </p>
    </div>
  );
};

export default GoogleOAuthCallback;
