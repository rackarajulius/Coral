import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getJobseekerModeration,
  type ReportOutcome,
  type ReportSource,
} from "@/lib/api/adminJobseekers";
import type { ReportQueueKey } from "@/lib/api/adminReports";

const SOURCE_LABEL: Record<ReportSource, string> = {
  posts: "Posts",
  comments: "Comments",
  reviews: "Company reviews",
  listings: "Marketplace listings",
  requests: "Marketplace requests",
};

/** Which Reports & Flags tab holds each source's open items. */
const SOURCE_TAB: Record<ReportSource, ReportQueueKey> = {
  posts: "community",
  comments: "community",
  reviews: "reviews",
  listings: "listings",
  requests: "requests",
};

const OUTCOME_STYLE: Record<ReportOutcome, string> = {
  open: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  upheld: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  dismissed: "bg-muted text-muted-foreground",
  reviewed: "bg-muted text-muted-foreground",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What has happened around this person, as facts: reports about what they
 * wrote and how each was decided, what moderators removed, and what was done
 * to the account. It replaces a "risk score" that was a constant 0/Low — and
 * deliberately does not become a real score: a number or label about a person
 * gets used to decide things no one can then explain.
 *
 * Loaded when the drawer opens, not with the list.
 */
export function JobseekerModerationRecord({ userId }: { userId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "jobseekers", "moderation", userId],
    queryFn: () => getJobseekerModeration(userId),
    retry: false,
  });

  return (
    <section className="px-6 py-5">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Reports &amp; moderation</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        What happened, not a score. A dismissed report is not evidence.
      </p>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 p-3">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* Reports about what they wrote */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reports about their content</p>
            {data.reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has reported anything they wrote.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/40 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Where</th>
                      <th className="px-2 py-2 text-right font-medium">Open</th>
                      <th className="px-2 py-2 text-right font-medium">Upheld</th>
                      <th className="px-2 py-2 text-right font-medium">Dismissed</th>
                      {data.reports.some((r) => r.reviewed > 0) && (
                        <th className="px-2 py-2 text-right font-medium" title="Marketplace queues record that an admin looked, not what was decided.">
                          Reviewed
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.reports.map((r) => (
                      <tr key={r.source} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">
                          {SOURCE_LABEL[r.source]}
                          {r.open > 0 && (
                            <Link
                              to={`/admin/reports?tab=${SOURCE_TAB[r.source]}`}
                              className="ml-2 text-xs text-primary hover:underline"
                            >
                              Review
                            </Link>
                          )}
                        </td>
                        <td className={cn("px-2 py-2 text-right tabular-nums", r.open > 0 && "font-semibold text-amber-700 dark:text-amber-400")}>{r.open}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.upheld}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.dismissed}</td>
                        {data.reports.some((x) => x.reviewed > 0) && (
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.reviewed}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.recent.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 font-medium capitalize", OUTCOME_STYLE[r.outcome])}>{r.outcome}</span>
                    <span className="capitalize text-foreground">{r.reason.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">· {SOURCE_LABEL[r.source].toLowerCase()} · {day(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* What moderators took down */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Removed by moderators</p>
            {(() => {
              const parts = [
                data.removed.posts && plural(data.removed.posts, "post"),
                data.removed.comments && plural(data.removed.comments, "comment"),
                data.removed.reviews && plural(data.removed.reviews, "review"),
                data.removed.listings && plural(data.removed.listings, "listing"),
              ].filter(Boolean);
              return (
                <p className={cn("text-sm", parts.length ? "text-foreground" : "text-muted-foreground")}>
                  {parts.length ? parts.join(", ") : "Nothing removed."}
                </p>
              );
            })()}
          </div>

          {/* Account actions */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Account actions</p>
            {data.accountActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suspensions, bans or reinstatements.</p>
            ) : (
              <ul className="space-y-1">
                {data.accountActions.map((a, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {a.summary.replace(/^Status:\s*/, "")}
                    <span className="text-xs text-muted-foreground"> · {a.by} · {day(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Identity verification */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Identity verification</p>
            <p className="text-sm text-foreground">
              {!data.identity
                ? <span className="text-muted-foreground">Never submitted.</span>
                : data.identity.status === "APPROVED"
                  ? `Approved ${day(data.identity.at)}`
                  : data.identity.status === "REJECTED"
                    ? `Rejected ${day(data.identity.at)}`
                    : `Submitted ${day(data.identity.at)}, awaiting review`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
