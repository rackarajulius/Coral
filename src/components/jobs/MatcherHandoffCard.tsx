import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { accountSide } from "@/lib/accountSide";
import { getMyEntitlements, refusalFor } from "@/lib/api/entitlements";
import { useAppSelector } from "@/hooks/useAppDispatch";
import { FREE_MATCHER_STATE, matcherPath } from "@/lib/resumeMatcher/handoff";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";

/** Fewer jobs than this, and a search here is thin enough to offer the web. */
export const THIN_RESULTS = 5;

/**
 * Find Jobs lists only jobs posted here. When a search turns up few of them,
 * this carries the same search to AI Job Match, which also looks across the
 * web and ranks what it finds against the person's resume.
 */
export default function MatcherHandoffCard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const side = accountSide(user);
  const { keywords, location, remote } = useAppSelector((state) => state.jobs.filters);
  const { data: entitlements, isFetching: isCheckingAccess, isError: accessCheckFailed } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    staleTime: 60_000,
    retry: false,
    enabled: side === "seeker",
  });

  // Not on an employer account's personal side yet: the matcher needs
  // Premium, which is still a job seeker plan.
  if (side === "employer" || side === "provider") return null;

  const query = keywords.trim();
  const place = location.trim();
  const isRemote = remote || /^remote$/i.test(place);
  const title = !query
    ? "Search jobs across the web"
    : isRemote
      ? `Search the web for remote “${query}” roles`
      : place
        ? `Search the web for “${query}” in ${place}`
        : `Search the web for “${query}”`;
  // Said up front rather than after sign-up. A visitor's plan isn't known yet;
  // a signed-in seeker's is, and web results may already be theirs.
  const refusal = refusalFor(entitlements, "matcher.web");
  const premiumOnly = side === "visitor" || !!refusal;
  const destination = matcherPath({ query, location: place, remote: isRemote });

  return (
    <Link
      to={destination}
      onClick={(event) => {
        // Preserve normal link behavior for opening another tab. Its matcher
        // response will still open pricing if web matching is unavailable.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (isAuthLoading || isCheckingAccess || accessCheckFailed || (side !== "visitor" && !refusal)) return;
        event.preventDefault();
        showUpgrade({
          ...(refusal ?? { metric: "matcher.web", message: "Matches from across the web are part of Premium." }),
          alternative: side === "visitor" ? undefined : {
            label: "Continue with free matches",
            run: () => navigate(destination, { state: FREE_MATCHER_STATE }),
          },
        });
      }}
      className="group flex items-start gap-3 rounded-xl border border-coral/25 bg-coral/5 p-4 transition-colors hover:border-coral/50 hover:bg-coral/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral/10 text-coral-dark">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          AI Job Match also searches job boards and company career sites, and ranks what it finds
          against your resume.{premiumOnly && " Results from across the web are part of Premium."}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-coral-dark">
          Open AI Job Match
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
