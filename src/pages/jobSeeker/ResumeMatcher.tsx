import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { Loader, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { Button } from "@/components/ui/button";
import type { MatchSearch } from "@/lib/api/resumeMatcher";
import { MatchFilterBar } from "@/components/resumeMatcher/MatchFilterBar";
import { MatchList } from "@/components/resumeMatcher/MatchList";
import { MatchSearchForm } from "@/components/resumeMatcher/MatchSearchForm";
import {
  NoFilteredMatches,
  NoMatches,
  NoProfile,
  WebScopeNotice,
} from "@/components/resumeMatcher/ResultStates";
import { Centered } from "@/components/resumeMatcher/shared";
import ResumeMatcherLanding from "@/components/resumeMatcher/ResumeMatcherLanding";
import { DEFAULT_FILTERS, applyMatchFilters, type MatchFilters } from "@/lib/resumeMatcher/matchFilters";
import { searchKey } from "@/lib/resumeMatcher/search";
import { matchRunKey, useResumeMatchRun } from "@/hooks/useResumeMatchRun";
import { useHiddenMatches } from "@/hooks/useHiddenMatches";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { MATCHER_PATH, handoffParams, readMatcherHandoff } from "@/lib/resumeMatcher/handoff";
import { JobsTabs } from "@/components/jobs/JobsTabs";

const ResumeMatcher = () => {
  useDocumentTitle("AI Job Match");
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Sign-in comes back here with the search the link carried.
  const signInHere = () => openAuth({ redirectTo: `${MATCHER_PATH}${location.search}` });
  /** A search carried here from Find Jobs or the home page. Read once, when the page opens. */
  const [handoff] = useState(() => readMatcherHandoff(searchParams));
  const [searchInput, setSearchInput] = useState(handoff.search?.query ?? "");
  /** The location box, and the country of the city picked in it (none when typed freely). */
  const [locationInput, setLocationInput] = useState(handoff.search?.location ?? "");
  const [locationCountry, setLocationCountry] = useState<string | undefined>(handoff.search?.countryCode);
  const [locationTouched, setLocationTouched] = useState(handoff.search?.location !== undefined);
  /** The search that was run. Undefined when it matches the profile as it stands. */
  const [active, setActive] = useState<MatchSearch | undefined>(handoff.search);
  const [filters, setFilters] = useState<MatchFilters>(
    handoff.remote ? { ...DEFAULT_FILTERS, workplaces: ["remote"] } : DEFAULT_FILTERS,
  );
  const { hiddenIds, notInterested } = useHiddenMatches();

  const { result, isFetching, isError, error, refetch, scoringPending, hasHeuristicScores } = useResumeMatchRun({
    active,
    userId: user?.id,
    isAuthenticated,
    isAuthLoading,
    continueWithFreeMatches: !!location.state?.continueWithFreeMatches,
  });

  // The location box shows where the search looked — the profile's city at
  // first — until the person changes it themselves.
  useEffect(() => {
    if (locationTouched || result?.location === undefined) return;
    setLocationInput(result.location);
    setLocationCountry(result.countryCode);
  }, [result?.location, result?.countryCode, locationTouched]);

  const visible = useMemo(() => (result?.matches ?? []).filter((m) => !hiddenIds.has(m.id)), [result, hiddenIds]);
  const filtered = useMemo(() => applyMatchFilters(visible, filters), [visible, filters]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading || isFetching) return;
    if (!isAuthenticated) {
      signInHere();
      return;
    }
    const next: MatchSearch = {
      query: searchInput.trim() || undefined,
      // Always sent, so an emptied box means anywhere rather than the profile's city.
      location: locationInput.trim(),
      countryCode: locationCountry,
    };
    if (active && searchKey(next).join("|") === searchKey(active).join("|")) {
      void refetch({ cancelRefetch: false });
      return;
    }
    // An explicit search refreshes even a recently visited query.
    void queryClient.invalidateQueries({
      queryKey: matchRunKey(user?.id ?? "", next),
      exact: true,
      refetchType: "none",
    });
    setActive(next);
    // The address names the search, so a reload or a shared link repeats it.
    const remoteOnly = filters.workplaces.length === 1 && filters.workplaces[0] === "remote";
    setSearchParams(handoffParams(next, remoteOnly), { replace: true });
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <ResumeMatcherLanding onGetMatches={signInHere} />
      </div>
    );
  }

  return (
    // Clip, so the filter bar's full-width line can't add a sideways scroll on Windows.
    <div className="min-h-screen overflow-x-clip bg-background">
      <Header />
      <div className="pt-16">
        <JobsTabs />
      </div>
      {/* Wide enough for one column of cards beside the job details drawer. */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-foreground">Jobs matched to your resume</h1>
          <p className="text-muted-foreground mt-1">
            Roles ranked against your profile — jobs posted here, and from across the web with
            Premium. Search a specific role, or let us match you.
          </p>
        </div>

        <MatchSearchForm
          searchInput={searchInput}
          locationInput={locationInput}
          locationCountry={locationCountry}
          resultCountryCode={result?.countryCode}
          homeCountryCode={result?.homeCountryCode}
          searching={isFetching}
          disabled={isFetching || isAuthLoading}
          onSearchChange={setSearchInput}
          onLocationChange={(text, countryCode) => {
            setLocationInput(text);
            setLocationCountry(countryCode);
            setLocationTouched(true);
          }}
          onSubmit={submitSearch}
        />

        {isAuthLoading ? (
          <Centered><Loader className="h-4 w-4 animate-spin" /> Loading…</Centered>
        ) : isError ? (
          <Centered>
            <span className="text-destructive">{(error as Error)?.message || "Something went wrong."}</span>
            <Button variant="outline" disabled={isFetching} onClick={() => void refetch({ cancelRefetch: false })}>
              {isFetching ? "Retrying…" : "Retry"}
            </Button>
          </Centered>
        ) : result && !result.hasProfile ? (
          <NoProfile />
        ) : isFetching && !result ? (
          <Centered>
            <Loader className="h-4 w-4 animate-spin" /> Finding matches…
          </Centered>
        ) : result ? (
          <>
            {result.scope === "platform" && result.webBlockedReason && (
              <WebScopeNotice reason={result.webBlockedReason} />
            )}
            {hasHeuristicScores && (
              <p role="status" className="mb-5 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                AI scoring is temporarily unavailable. Results labeled “Keyword match” use overlap with your saved skills.
              </p>
            )}
            {visible.length === 0 ? (
              <NoMatches
                query={result.query}
                fromProfile={!active?.query}
                searched={result.searchedSources ?? []}
                unavailable={result.unavailableSources ?? []}
              />
            ) : (
              <>
                {(result.unavailableSources?.length ?? 0) > 0 && (
                  <p role="status" className="mb-5 text-sm text-muted-foreground">
                    Some job sources didn't respond, so these results may be incomplete.
                  </p>
                )}
                {result.localQuery && result.localLanguage && (
                  // Otherwise "Pflegefachkraft" cards for a "nurse" search look like a mistake.
                  <p className="mb-3 text-sm text-muted-foreground">
                    Also searched ads in {result.localLanguage}: “{result.localQuery}”
                  </p>
                )}
                {scoringPending && (
                  <p role="status" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ranking these against your resume…
                  </p>
                )}
                <MatchFilterBar filters={filters} onChange={setFilters} shown={filtered.length} total={visible.length} />
                {filtered.length === 0 ? (
                  <NoFilteredMatches onClear={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} />
                ) : (
                  <MatchList matches={filtered} loading={isFetching} onNotInterested={notInterested} />
                )}
              </>
            )}
          </>
        ) : (
          <Centered>Search again to refresh your matches.</Centered>
        )}
      </main>
    </div>
  );
};

export default ResumeMatcher;
