import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runResumeMatch, scoreResumeMatch, type MatchRunResult, type MatchSearch } from "@/lib/api/resumeMatcher";
import { searchKey } from "@/lib/resumeMatcher/search";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";

/** The query key for a search's matches, shared by the run and the scoring that follows it. */
export function matchRunKey(userId: string, search: MatchSearch | undefined) {
  return ["resume-matcher", "run", userId, ...searchKey(search)];
}

/**
 * Runs a match search, then fills in its AI scores, and offers Premium once
 * per visit when web matches were held back.
 */
export function useResumeMatchRun({
  active,
  userId,
  isAuthenticated,
  isAuthLoading,
  continueWithFreeMatches,
}: {
  active: MatchSearch | undefined;
  userId: string | undefined;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  /** The person already chose free matches over the plans, e.g. from the upgrade prompt. */
  continueWithFreeMatches: boolean;
}) {
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const promptedForUser = useRef<string | null>(null);

  /**
   * Runs for every signed-in job seeker. This page used to be a wall for anyone without
   * Premium, which would have denied free users the platform matching their
   * tier includes. The server decides which sources to search and says so.
   */
  const { data: result, isFetching, isPlaceholderData, isError, error, refetch } = useQuery({
    queryKey: matchRunKey(userId ?? "", active),
    queryFn: async ({ signal }) => {
      const data = await runResumeMatch(active, signal);
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      return data;
    },
    enabled: isAuthenticated && !isAuthLoading,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === userId ? previousData : undefined,
    // Each completed web search can consume allowance; retry explicitly.
    retry: false,
    refetchOnReconnect: false,
  });

  // Web matching returns free platform results rather than throwing an
  // entitlement error. Open the same plan cards as other premium actions,
  // once per visit, and leave those free results available after dismissal.
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || !userId) return;
    if (continueWithFreeMatches) {
      // Remember this choice even when a later search replaces the URL state.
      promptedForUser.current = userId;
      return;
    }
    if (
      isFetching || isPlaceholderData || isError ||
      !result?.hasProfile || result.scope !== "platform" || result.webBlockedReason !== "PREMIUM_REQUIRED" ||
      promptedForUser.current === userId
    ) return;

    promptedForUser.current = userId;
    showUpgrade({
      code: "PREMIUM_REQUIRED",
      metric: "matcher.web",
      tier: "free",
      message: "Matches from across the web are part of Premium.",
    });
  }, [isAuthenticated, isAuthLoading, userId, isFetching, isPlaceholderData, isError, result, continueWithFreeMatches, showUpgrade]);

  /**
   * The jobs come first, ranked by keywords, and their AI scores follow from
   * a second request, re-ranked. The page used to wait for the AI (about 7s
   * of a search) before showing anything.
   */
  const scoringPending = !!result?.matches.some((m) => m.scoringMode === "pending");
  useEffect(() => {
    if (!scoringPending || isFetching || isPlaceholderData || !userId) return;
    const key = matchRunKey(userId, active);
    const controller = new AbortController();
    scoreResumeMatch(active, controller.signal).then(
      (scored) => queryClient.setQueryData(key, scored),
      () => {
        if (controller.signal.aborted) return;
        // Without them the keyword scores stand, and the page says so.
        queryClient.setQueryData<MatchRunResult>(key, (old) =>
          old && {
            ...old,
            matches: old.matches.map((m) => (m.scoringMode === "pending" ? { ...m, scoringMode: "heuristic" } : m)),
          },
        );
      },
    );
    return () => controller.abort();
  }, [scoringPending, isFetching, isPlaceholderData, userId, active, queryClient]);

  // AI scoring failed for the search, not just for one job it missed: one
  // keyword-scored card used to put the whole page under the notice below.
  const hasHeuristicScores =
    !!result?.matches.length && result.matches.every((match) => match.scoringMode === "heuristic");

  return { result, isFetching, isError, error, refetch, scoringPending, hasHeuristicScores };
}
