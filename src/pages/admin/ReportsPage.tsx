import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/api/community";
import {
  getReportsSummary,
  REPORTS_SUMMARY_KEY,
  type ReportQueueKey,
  type ReportQueueSummary,
} from "@/lib/api/adminReports";
import CommunityReportQueue from "@/components/community/CommunityReportQueue";
import MarketplaceModeration from "@/components/marketplace/MarketplaceModeration";
import MarketplaceRequestReports from "@/components/marketplace/MarketplaceRequestReports";
import ReviewQueue from "@/components/adminDashboard/reports/ReviewQueue";

const QUEUES: { key: ReportQueueKey; label: string }[] = [
  { key: "community", label: "Posts & comments" },
  { key: "listings", label: "Marketplace listings" },
  { key: "requests", label: "Marketplace requests" },
  { key: "reviews", label: "Company reviews" },
];

const isQueue = (v: string | null): v is ReportQueueKey => QUEUES.some((q) => q.key === v);

/** One line on what is waiting, in the queue's own terms. */
function waitingLine(q: ReportQueueSummary | undefined): string {
  if (!q) return "";
  if (q.open === 0) return "Nothing waiting.";
  const parts: string[] = [];
  if (q.key === "community" && q.detail) {
    parts.push(`${q.detail.posts ?? 0} post${q.detail.posts === 1 ? "" : "s"}, ${q.detail.comments ?? 0} comment${q.detail.comments === 1 ? "" : "s"}`);
  } else if (q.key === "reviews" && q.detail) {
    parts.push(`${q.detail.held ?? 0} held by the automated checks, ${q.detail.reported ?? 0} reported after publishing`);
  } else {
    parts.push(`${q.open} waiting`);
  }
  if (q.oldestAt) {
    const age = timeAgo(q.oldestAt);
    parts.push(age === "just now" ? "oldest just in" : /^\d/.test(age) ? `oldest waiting ${age}` : `oldest since ${age}`);
  }
  return parts.join(" · ");
}

/**
 * Reports & Flags: every moderation queue in one place, one tab each.
 *
 * Each tab is that queue's own component, the same one used where the queue
 * lived before, so the rules about what can be done — what needs a reason,
 * what can be restored, what stays private — are not restated here.
 * The counts come from one summary call and refresh after every decision.
 */
export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const tab = isQueue(params.get("tab")) ? (params.get("tab") as ReportQueueKey) : "community";

  const summary = useQuery({
    queryKey: REPORTS_SUMMARY_KEY,
    queryFn: getReportsSummary,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const byKey = new Map(summary.data?.queues.map((q) => [q.key, q]));

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports &amp; Flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.data
            ? summary.data.total === 0
              ? "Nothing is waiting for a decision."
              : `${summary.data.total.toLocaleString()} waiting for a decision across all queues, oldest first in each.`
            : "Everything waiting for a moderation decision, one tab per queue."}
        </p>
        {summary.isError && (
          <p className="mt-1 text-xs text-destructive">
            The counts couldn't be loaded: {(summary.error as Error).message}. The queues below still work.
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-secondary p-1">
          {QUEUES.map((q) => {
            const open = byKey.get(q.key)?.open;
            return (
              <TabsTrigger key={q.key} value={q.key} className="gap-2 rounded-md">
                {q.label}
                {open !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
                      open > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-label={`${open} waiting`}
                  >
                    {open}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {waitingLine(byKey.get(tab))}
        </p>

        <TabsContent value="community" className="mt-4">
          <CommunityReportQueue />
        </TabsContent>
        <TabsContent value="listings" className="mt-4">
          <MarketplaceModeration className="" />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <MarketplaceRequestReports showActivity={false} className="space-y-4" />
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <ReviewQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
