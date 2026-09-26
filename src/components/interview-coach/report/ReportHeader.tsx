import { format } from "date-fns";
import { Download, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { difficultyLabel, interviewTypeLabel } from "@/data/interview-coach/constants";
import { exportReportPdf } from "@/data/interview-coach/reportPdf";
import type { HistoryEntry, Readiness } from "@/data/interview-coach/types";
import { readinessLabel, useInterviewHistoryStore } from "@/stores/interviewHistoryStore";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import ScoreRing from "../shared/ScoreRing";

// System badge variants only: brand orange for a positive verdict, neutral for
// in-progress, destructive for not-ready.
const READINESS_VARIANT: Record<Readiness, "outline" | "secondary" | "destructive"> = {
  strong: "outline",
  ready: "outline",
  "getting-there": "secondary",
  "not-ready": "destructive",
};

export default function ReportHeader({ entry }: { entry: HistoryEntry }) {
  const prefillFrom = useInterviewSetupStore((s) => s.prefillFrom);
  const openSetup = useInterviewSetupStore((s) => s.openModal);
  const report = entry.report!;
  const stats = useInterviewHistoryStore((s) => s.entries);
  const isLatest = stats[0]?.id === entry.id;

  const practiceAgain = () => {
    prefillFrom(entry.config);
    openSetup();
  };

  return (
    <section className="rounded-3xl border border-ink/10 bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <ScoreRing score={report.overallScore} size={128} strokeWidth={9} label="overall" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={READINESS_VARIANT[report.readiness]}>
              {readinessLabel[report.readiness]}
            </Badge>
            {entry.improvementVsPrev != null && (
              <Badge
                variant="secondary"
                className={cn(
                  "tabular",
                  entry.improvementVsPrev >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {entry.improvementVsPrev >= 0 ? "▲" : "▼"} {Math.abs(entry.improvementVsPrev)} vs
                previous
              </Badge>
            )}
            {!isLatest && <Badge variant="secondary">past session</Badge>}
          </div>

          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {entry.config.role}
          </h1>
          <p className="mt-1 text-sm text-ink-dim">
            {interviewTypeLabel(entry.config.type)} · {difficultyLabel(entry.config.difficulty)} ·{" "}
            {format(new Date(entry.createdAt), "MMMM d, yyyy")} ·{" "}
            {Math.max(1, Math.round(entry.durationSec / 60))} min
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink">{report.recommendation}</p>
        </div>

        <div className="flex shrink-0 flex-row gap-3 md:flex-col">
          <Button onClick={practiceAgain} className="rounded-full bg-coral px-6 text-white hover:bg-coral/90">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Practice again
          </Button>
          <Button
            variant="outline"
            onClick={() => exportReportPdf(entry)}
            className="rounded-full border-ink/15 bg-transparent text-ink hover:bg-surface-2 hover:text-ink"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export PDF
          </Button>
        </div>
      </div>
    </section>
  );
}
