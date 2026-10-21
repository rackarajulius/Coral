import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import MarketplaceModeration from "@/components/marketplace/MarketplaceModeration";
import MarketplaceRequestReports from "@/components/marketplace/MarketplaceRequestReports";
import {
  dismissReport,
  listReports,
  removeReportedComment,
  removeReportedPost,
  timeAgo,
  type ModerationReport,
  type ReportStatus,
} from "@/lib/api/community";

const TABS: { id: ReportStatus; label: string }[] = [
  { id: "OPEN", label: "Open" },
  { id: "ACTIONED", label: "Actioned" },
  { id: "DISMISSED", label: "Dismissed" },
];

/**
 * The moderation queue.
 *
 * Open reports come back oldest first: the concern that has waited longest is
 * the one most likely to have done damage while waiting.
 *
 * Access is decided by the server — anyone without it gets a refusal, which is
 * shown as-is rather than being pre-empted by hiding the page. Hiding it would
 * mean this component deciding who is a moderator, and it does not know.
 */
export default function ModerationPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ReportStatus>("OPEN");

  const reports = useQuery({
    queryKey: ["moderation-reports", status],
    queryFn: () => listReports(status),
    retry: false,
  });

  return (
    <>
      <main>
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <header className="mb-5">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              Moderation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reported posts and comments, oldest first.
            </p>
          </header>

          <div className="mb-5 flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatus(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  status === t.id
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {reports.isLoading && (
            <div className="space-y-3">
              {[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          )}

          {reports.isError && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{(reports.error as Error).message}</p>
            </div>
          )}

          {reports.data?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium">
                {status === "OPEN" ? "Nothing waiting" : "Nothing here"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "OPEN"
                  ? "Reports appear here as they come in."
                  : "No reports with this status yet."}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {reports.data?.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
          {user?.role === "ADMIN" && <MarketplaceModeration />}
          {user?.role === "ADMIN" && <MarketplaceRequestReports />}
        </div>
      </main>
    </>
  );
}

function ReportCard({ report }: { report: ModerationReport }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["moderation-reports"] });

  const remove = useMutation({
    mutationFn: () =>
      report.target?.kind === "post"
        ? removeReportedPost(report.target.id, reason.trim())
        : removeReportedComment(report.target!.id),
    onSuccess: () => {
      toast.success("Removed");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const dismiss = useMutation({
    mutationFn: () => dismissReport(report.id, reason.trim() || undefined),
    onSuccess: () => {
      toast.success("Dismissed");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const busy = remove.isPending || dismiss.isPending;
  const isPost = report.target?.kind === "post";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {report.reason.replace(/_/g, " ")}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {report.target?.kind ?? "unknown"} · {timeAgo(report.createdAt)}
        </span>
        {report.target?.removed && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Already removed
          </Badge>
        )}
      </div>

      {report.detail && (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Reporter said:</span> {report.detail}
        </p>
      )}

      {/* The content itself, so a decision is made on what was written rather
          than on how it was described. */}
      {report.target ? (
        <blockquote className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">
          {report.target.content || <span className="text-muted-foreground">(no text)</span>}
        </blockquote>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          The reported item no longer exists.
        </p>
      )}

      {report.status === "OPEN" && report.target && (
        <div className="mt-4 space-y-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isPost ? "Reason for removal (required)" : "Note (optional)"}
            maxLength={500}
            className="text-sm"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => dismiss.mutate()} disabled={busy}>
              {dismiss.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Nothing wrong
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => remove.mutate()}
              // A removal reason is required on posts: it is written into the
              // moderation record and is the only account of why this happened.
              disabled={busy || (isPost && !reason.trim())}
            >
              {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Remove
            </Button>
          </div>
          {isPost && (
            <p className="text-right text-[11px] text-muted-foreground">
              Removing also deletes any images on the post. That cannot be undone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
