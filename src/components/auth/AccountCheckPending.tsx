import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/** How long to show only a spinner before explaining the wait. */
const EXPLAIN_AFTER_MS = 8_000;

/**
 * Shown by a guard while the account's role and status are still unknown.
 *
 * Guards used to decide on placeholder values here and sent finished users
 * back to onboarding. Waiting is right; the retry in AuthContext usually
 * resolves this within seconds. If it doesn't, say so plainly.
 */
export function AccountCheckPending({ className = "min-h-screen" }: { className?: string }) {
  const { refreshUser } = useAuth();
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), EXPLAIN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${className} flex items-center justify-center bg-background px-4`} role="status" aria-live="polite">
      <div className="max-w-sm text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        {slow ? (
          <>
            <p className="mt-4 font-medium text-foreground">We can't reach your account right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll keep trying. Check your connection, or try again in a moment.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                await refreshUser().catch(() => null);
                setRetrying(false);
              }}
            >
              {retrying ? "Trying…" : "Try again"}
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Checking your account…</p>
        )}
      </div>
    </div>
  );
}

export default AccountCheckPending;
