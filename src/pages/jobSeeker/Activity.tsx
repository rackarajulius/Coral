import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UNDERLINE_TABS_LIST, UNDERLINE_TAB_TRIGGER } from "@/lib/tabStyles";
import { getMyApplications } from "@/lib/api/applications";
import { getMySavedJobs } from "@/lib/api/savedJobs";
import { getMyAlerts } from "@/lib/api/jobAlerts";
import { getMyInterviews } from "@/lib/api/hiring";
import SavedPane from "@/components/talent/jobactivity/SavedPane";
import AlertsPane from "@/components/talent/jobactivity/AlertsPane";
import AppliedPane from "@/components/talent/jobactivity/AppliedPane";
import ErrorState from "@/components/talent/jobactivity/ErrorState";
import EmptyState from "@/components/talent/jobactivity/EmptyState";
import SkeletonPane from "@/components/talent/jobactivity/SkeletonPane";
import InterviewsPane from "@/components/talent/jobactivity/InterviewsPane";
import OffersPane from "@/components/talent/jobactivity/OffersPane";
import { getMyOffers } from "@/lib/api/myOffers";
import { getExternalApplications } from "@/lib/api/externalApplications";
import ExternalApplicationsPane from "@/components/talent/jobactivity/ExternalApplicationsPane";
import KpiStrip from "@/components/talent/jobactivity/KpiStrip";
import ReviewablePrompt from "@/components/reviews/ReviewablePrompt";
import { TABS, isTabId, type TabId } from "@/components/talent/jobactivity/constants";
import Header from "@/components/Header";
import ProgressSidebar from "@/components/jobSeeker/ProgressSidebar";

/* ---------------------------- Loading & errors --------------------------- */

type LoadState = "loading" | "error" | "ready";

function useTabLoader(tab: TabId): { state: LoadState; retry: () => void } {
  const [state, setState] = useState<LoadState>("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const delay = 650 + Math.floor(Math.random() * 350);
    const id = window.setTimeout(() => {
      if (cancelled) return;
      // Error simulation via ?error=<tab> or ?error=all
      const params = new URLSearchParams(window.location.search);
      const errFlag = params.get("error");
      const shouldError = errFlag === "all" || errFlag === tab;
      setState(shouldError ? "error" : "ready");
    }, delay);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [tab, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry };
}

/* ------------------------------ Page Shell ------------------------------- */

const Activity = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = isTabId(tabParam) ? tabParam : "saved";

  const setTab = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Keep the default tab out of the URL for a clean address.
          if (id === "saved") next.delete("tab");
          else next.set("tab", id);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const { state, retry } = useTabLoader(tab);
  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "section";

  // Applied & Saved are real; the shared queries also power the tab badge counts.
  const { data: myApps } = useQuery({
    queryKey: ["my-applications"],
    queryFn: getMyApplications,
    staleTime: 60_000,
  });
  const { data: mySaved } = useQuery({
    queryKey: ["my-saved-jobs"],
    queryFn: getMySavedJobs,
    staleTime: 60_000,
  });
  const { data: myAlerts } = useQuery({
    queryKey: ["my-alerts"],
    queryFn: getMyAlerts,
    staleTime: 60_000,
  });
  const { data: myInterviews } = useQuery({
    queryKey: ["my-interviews"],
    queryFn: getMyInterviews,
    staleTime: 60_000,
  });

  const { data: myOffers } = useQuery({
    queryKey: ["my-offers"],
    queryFn: getMyOffers,
    staleTime: 60_000,
    retry: false,
  });
  const { data: externalApplications } = useQuery({
    queryKey: ["external-applications"],
    queryFn: getExternalApplications,
    staleTime: 60_000,
    retry: false,
  });

  const counts: Partial<Record<TabId, number>> = {
    saved: mySaved?.length,
    alerts: myAlerts?.length,
    applied: myApps?.length,
    external: externalApplications?.length,
    // Actionable interviews: pending invitations + confirmed upcoming.
    interviews: myInterviews?.filter((i) => i.status === "proposed" || i.status === "confirmed").length,
    // Only offers still awaiting an answer. A declined one is history, and a
    // badge counting it would nag about a decision already made.
    offers: myOffers?.filter((o) => o.status === "SENT").length,
  };

  const renderPanel = () => {
    // Applied & Saved own their loading/error/empty (react-query), so bypass the
    // simulated tab loader used by the still-mock tabs.
    if (tab === "applied") return <AppliedPane />;
    if (tab === "saved") return <SavedPane />;
    if (tab === "external") return <ExternalApplicationsPane />;
    if (tab === "alerts") return <AlertsPane />;
    if (tab === "interviews") return <InterviewsPane />;
    if (tab === "offers") return <OffersPane />;
    if (state === "loading") return <SkeletonPane tab={tab} />;
    if (state === "error") return <ErrorState tab={tab} onRetry={retry} />;
    return (
      <>
        {tab === "viewed" && (
          <EmptyState
            tab="viewed"
            heading="No recently viewed jobs"
            body="Jobs you open will show up here so you can quickly jump back to opportunities you were exploring earlier."
            cta="Discover Jobs"
          />
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-6 pt-16">
              <ProgressSidebar />
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0 pt-16">
            {/* Title block */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Activity</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Track your saved jobs, Coral and external applications, alerts, and interviews in one place.
              </p>
            </div>

            {/* At-a-glance stats, computed from real applications. */}
            <KpiStrip />

            {/* Renders nothing when there's nothing to review. */}
            <ReviewablePrompt />

            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
              {/* Sticky tab bar — horizontal scroll lives on the wrapper (with a
                  1px bottom pad) so the active underline isn't clipped on mobile. */}
              <div className="sticky top-16 z-10 -mx-4 px-4 pb-px bg-white dark:bg-gray-900 overflow-x-auto no-scrollbar">
                <TabsList className={UNDERLINE_TABS_LIST}>
                  {TABS.map((t) => {
                    const count = counts[t.id];
                    return (
                      <TabsTrigger key={t.id} value={t.id} className={`group ${UNDERLINE_TAB_TRIGGER}`}>
                        {t.label}
                        {typeof count === "number" && count > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground transition-colors group-data-[state=active]:bg-orange-500/10 group-data-[state=active]:text-orange-700 dark:group-data-[state=active]:text-orange-400">
                            {count}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Screen-reader announcement of the current section's load state */}
              <div role="status" aria-live="polite" className="sr-only">
                {state === "loading" && `Loading ${tabLabel}…`}
                {state === "ready" && `${tabLabel} loaded`}
                {state === "error" && `Couldn't load ${tabLabel}`}
              </div>

              {TABS.map((t) => (
                <TabsContent key={t.id} value={t.id} className="mt-0 focus-visible:outline-none">
                  {renderPanel()}
                </TabsContent>
              ))}
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Activity;
