import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CoachShell from "@/components/interview-coach/shared/CoachShell";
import EmptyState from "@/components/interview-coach/shared/EmptyState";
import HistoryTable from "@/components/interview-coach/history/HistoryTable";
import ReportDetailDrawer from "@/components/interview-coach/report/ReportDetailDrawer";
import { INTERVIEW_TYPES } from "@/data/interview-coach/constants";
import type { InterviewType } from "@/data/interview-coach/types";
import { useInterviewHistoryStore } from "@/stores/interviewHistoryStore";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

type Filter = InterviewType | "all";

export default function InterviewHistory() {
  const entries = useInterviewHistoryStore((s) => s.entries);
  const seedDemo = useInterviewHistoryStore((s) => s.seedDemo);
  const loadHistory = useInterviewHistoryStore((s) => s.load);

  // History lives server-side — fetch it on mount.
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const setupReset = useInterviewSetupStore((s) => s.reset);
  const openSetup = useInterviewSetupStore((s) => s.openModal);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchParams, setSearchParams] = useSearchParams();

  // The report lives in a drawer keyed off ?report=<id>, so deep links and the
  // browser back button open and close it like a page would.
  const reportId = searchParams.get("report");
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === reportId) ?? null,
    [entries, reportId],
  );

  const openReport = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("report", id);
      return next;
    });
  };

  const closeReport = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("report");
        return next;
      },
      { replace: true },
    );
  };

  const newInterview = () => {
    setupReset();
    openSetup();
  };

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.config.type === filter)),
    [entries, filter],
  );

  const usedTypes = useMemo(
    () => INTERVIEW_TYPES.filter((t) => entries.some((e) => e.config.type === t.id)),
    [entries],
  );

  return (
    <CoachShell
      title="Interview history"
      subtitle="Every practice session, scored and searchable — watch the trend line climb."
      actions={
        <Button onClick={newInterview} className="rounded-full bg-coral px-6 text-white hover:bg-coral/90">
          New interview
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          heading="No interviews yet"
          body="Your completed sessions will appear here with scores, trends, and one-click rematches. Run your first interview or explore with sample data."
        >
          <Button onClick={newInterview} className="rounded-full bg-coral px-6 text-white hover:bg-coral/90">
            Start an interview
          </Button>
          <Button
            variant="outline"
            onClick={seedDemo}
            className="rounded-full border-ink/15 bg-transparent text-ink hover:bg-surface-2 hover:text-ink"
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            Explore with sample data
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {usedTypes.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by interview type">
              {(["all", ...usedTypes.map((t) => t.id)] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                    filter === f
                      ? "bg-coral text-white"
                      : "border border-ink/10 bg-surface text-ink-dim hover:text-ink",
                  )}
                >
                  {f === "all" ? "All" : INTERVIEW_TYPES.find((t) => t.id === f)?.label}
                </button>
              ))}
            </div>
          )}

          <HistoryTable entries={filtered} onSelect={openReport} />
        </div>
      )}

      <ReportDetailDrawer entry={selectedEntry} onClose={closeReport} />
    </CoachShell>
  );
}
