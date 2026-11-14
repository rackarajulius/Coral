import { Link } from "react-router-dom";
import { Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";

/**
 * Says why these are only platform jobs.
 *
 * Shown above the results rather than instead of them: free users still get
 * real matches, and the button opens the plans.
 */
export function WebScopeNotice({ reason }: { reason: "PREMIUM_REQUIRED" | "ALLOWANCE_EXHAUSTED" }) {
  const showUpgrade = useUpgradePrompt((s) => s.show);
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="h-9 w-9 shrink-0 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
        <Lock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Showing jobs posted on this platform</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {/* Only a Premium member reaches the daily cap (free has no web
              searches), so that case is told when they're back, never sold Premium. */}
          {reason === "ALLOWANCE_EXHAUSTED" ? (
            "You've used today's web searches. Jobs from across the web come back tomorrow."
          ) : (
            <>
              Matches from across the web are part of Premium.{" "}
              <button
                type="button"
                onClick={() =>
                  showUpgrade({ metric: "matcher.web", message: "Matches from across the web are part of Premium." })
                }
                className="font-medium text-coral hover:underline"
              >
                See Premium
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function NoProfile() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-xl mx-auto">
      <div className="h-14 w-14 rounded-2xl bg-coral/10 text-coral flex items-center justify-center mx-auto mb-4">
        <UserPlus className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Complete your profile first</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        We match jobs against your resume. Add your skills and experience to your profile, then come back.
      </p>
      <Button variant="coral" className="mt-6" asChild>
        <Link to="/jobseeker/profile">Go to my profile</Link>
      </Button>
    </div>
  );
}

/**
 * Says why there is nothing to show.
 *
 * This used to tell everyone to add more detail to their profile, including
 * when no source had been reached and when none had anything for the role.
 * A profile too thin to match on gets its own screen (NoProfile), so here the
 * honest answers are "we couldn't look" or "nothing open fits this search".
 */
export function NoMatches({
  query,
  fromProfile,
  searched,
  unavailable,
}: {
  query: string;
  fromProfile: boolean;
  searched: string[];
  unavailable: string[];
}) {
  const couldNotLook = searched.length > 0 && unavailable.length === searched.length;
  return (
    <div role="status" className="py-16 text-center text-sm text-muted-foreground max-w-md mx-auto">
      {couldNotLook ? (
        <p>We couldn't reach our job sources just now. Try again in a few minutes.</p>
      ) : (
        <>
          <p className="font-medium text-foreground">
            No open roles match {fromProfile ? "your title, " : ""}“{query}” right now.
          </p>
          <p className="mt-1">
            {unavailable.length > 0
              ? "Some job sources didn't respond, so searching again later may find more."
              : `Try a broader role${fromProfile ? " in the search above" : ""}, like “Engineer” or “Designer”.`}
          </p>
        </>
      )}
    </div>
  );
}

/** Matches exist, but the filters leave none. */
export function NoFilteredMatches({ onClear }: { onClear: () => void }) {
  return (
    <div role="status" className="py-12 text-center text-sm text-muted-foreground max-w-md mx-auto">
      <p className="font-medium text-foreground">No matches fit these filters.</p>
      <p className="mt-1">
        A filter only keeps jobs that say what it asks about, and many listings don't state pay or
        whether they're remote.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
