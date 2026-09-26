import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Download, Loader2, Mic, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getScreenScorecard,
  getScreeningBoard,
  type BoardRow,
  // Aliased: the page component is also called ScreeningBoard.
  type ScreeningBoard as ScreeningBoardData,
  type ScreenMode,
} from "@/lib/api/aiScreen";
import {
  AccommodationNotes,
  IntegrityNotes,
  RecommendationChip,
  ScreenScorecard,
} from "@/components/employer-dashboard/candidates/ScreenScorecard";

const MODE_ICON: Record<ScreenMode, typeof Sparkles> = {
  text: Sparkles,
  video: Video,
  live: Mic,
};

/**
 * Ranked comparison of everyone who applied to one job.
 *
 * Deliberately lists applicants with no screen and those who declined, not just
 * finished ones — a board showing only completions would read as if the rest of
 * the pipeline didn't exist.
 */
export default function ScreeningBoard() {
  const { jobId } = useParams<{ jobId: string }>();
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["screening-board", jobId],
    queryFn: () => getScreeningBoard(jobId!),
    enabled: !!jobId,
    retry: false,
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <Link
          to="/employers/candidates"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to candidates
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Screening results{data ? ` — ${data.jobTitle}` : ""}
        </h1>
        {data && (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.summary.applicants} applicant{data.summary.applicants === 1 ? "" : "s"} ·{" "}
            {data.summary.scored} scored · {data.summary.invited} awaiting ·{" "}
            {data.summary.notInvited} not invited
            {data.summary.declined > 0 ? ` · ${data.summary.declined} declined` : ""}
          </p>
        )}
      </div>

      {data && data.rows.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => exportBoardCsv(data)}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Export CSV
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-destructive">
          {(error as Error)?.message || "Couldn't load the screening board"}
        </p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nobody has applied to this job yet.
        </p>
      ) : (
        <>
          {data.summary.scored === 0 && (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              No screenings have been scored yet, so there's nothing to rank. Invite applicants from
              the candidates list to start a round.
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Candidate</span>
              <span className="text-right">Score</span>
              <span className="w-28 text-right">Recommendation</span>
              <span className="w-6" />
            </div>

            {data.rows.map((row) => (
              <Row
                key={row.applicationId}
                row={row}
                open={openRow === row.applicationId}
                onToggle={() =>
                  setOpenRow((cur) => (cur === row.applicationId ? null : row.applicationId))
                }
              />
            ))}
          </div>

          {data.questions.length > 0 && (
            <details className="rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                The {data.questions.length} questions everyone was asked
              </summary>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {data.questions.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <p className="text-xs text-muted-foreground">
            Scores rank answers to the same questions — they are not a hiring decision. Review the
            scorecard before advancing or rejecting anyone.
          </p>
        </>
      )}
    </div>
  );
}

/** RFC 4180 quoting — names and titles routinely contain commas and quotes. */
function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  return `"${String(v).replace(/"/g, '""')}"`;
}

/**
 * Downloads the board as CSV — the integration every ATS and spreadsheet
 * accepts without a connector.
 *
 * Accommodation requests are deliberately NOT exported. A CSV gets emailed,
 * forwarded and archived far beyond the person who downloaded it, and someone's
 * access needs should not travel that way.
 *
 * Missing scores stay empty cells rather than 0 — a blank reads as "no score",
 * a zero reads as "scored zero".
 */
function exportBoardCsv(board: ScreeningBoardData) {
  const header = [
    "Candidate", "Current title", "Current company", "Applied", "Application status",
    "Screening mode", "Screening status", "Score", "Recommendation", "Completed",
  ];
  const rows = board.rows.map((r) => [
    r.name,
    r.currentTitle,
    r.currentCompany,
    r.appliedAt.slice(0, 10),
    r.applicationStatus,
    r.screen?.mode ?? "not invited",
    r.screen?.status ?? "",
    r.screen?.overallScore ?? null,
    r.screen?.recommendation ?? "",
    r.screen?.completedAt?.slice(0, 10) ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `screening-${board.jobTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${board.rows.length} candidates`);
}

function Row({ row, open, onToggle }: { row: BoardRow; open: boolean; onToggle: () => void }) {
  const s = row.screen;
  const scored = s?.overallScore != null;
  const Icon = s ? MODE_ICON[s.mode] : null;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={!scored}
        className={cn(
          "grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-left",
          scored ? "hover:bg-muted/40" : "cursor-default",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.currentTitle || "—"}
            {row.currentCompany ? ` · ${row.currentCompany}` : ""}
          </span>
        </span>

        <span className="text-right text-sm font-semibold tabular-nums">
          {scored ? (
            s!.overallScore
          ) : (
            <span className="font-normal text-muted-foreground">—</span>
          )}
        </span>

        <span className="flex w-28 justify-end">
          {s?.recommendation ? (
            <RecommendationChip recommendation={s.recommendation} />
          ) : (
            <StatusNote row={row} />
          )}
        </span>

        <span className="flex w-6 justify-end">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
          {scored && (
            <ChevronDown
              className={cn("ml-1 h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      {open && scored && <ExpandedScorecard screenId={s!.id} />}
    </div>
  );
}

/** Plain-language state for anyone without a score. Never a fake number. */
function StatusNote({ row }: { row: BoardRow }) {
  const s = row.screen;
  const text = !s
    ? "Not invited"
    : s.status === "declined"
      ? "Declined"
      : s.status === "completed"
        ? "Awaiting review"
        : s.mode === "live" && s.startedLive
          ? "In progress"
          : "Invited";
  return <span className="text-xs text-muted-foreground">{text}</span>;
}

function ExpandedScorecard({ screenId }: { screenId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ai-screen-scorecard", screenId],
    queryFn: () => getScreenScorecard(screenId),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-4">
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading scorecard…
        </p>
      ) : isError || !data?.evaluation ? (
        <p className="text-sm text-muted-foreground">This scorecard couldn't be loaded.</p>
      ) : (
        <div className="space-y-4">
          <AccommodationNotes accommodations={data.accommodations} />
          <ScreenScorecard evaluation={data.evaluation} />
          <IntegrityNotes integrity={data.integrity} />
        </div>
      )}
    </div>
  );
}

export { ScreeningBoard };
