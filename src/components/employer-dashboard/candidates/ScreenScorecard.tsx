import { Accessibility, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployerScreen, ScreenEvaluation } from "@/lib/api/aiScreen";

const NEED_LABEL: Record<string, string> = {
  extra_time: "More time to answer",
  typed_answers: "Typed answers instead of spoken",
  human_interviewer: "A human interviewer instead of the AI",
  assistive_tech: "Uses a screen reader or other assistive software",
  other: "Something else — see their note",
};

/**
 * Adjustments the candidate asked for. Shows WHAT they need and nothing about
 * why: no reason is collected, so none can be displayed or inferred.
 */
export function AccommodationNotes({
  accommodations,
}: {
  accommodations: EmployerScreen["accommodations"];
}) {
  if (!accommodations?.needs.length) return null;
  const wantsHuman = accommodations.needs.includes("human_interviewer");
  return (
    <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
        <Accessibility className="h-3.5 w-3.5" aria-hidden="true" /> Adjustments requested
      </p>
      <ul className="mt-2 space-y-1 text-sm text-foreground/80">
        {accommodations.needs.map((n) => (
          <li key={n}>• {NEED_LABEL[n] ?? n}</li>
        ))}
      </ul>
      {accommodations.note && (
        <p className="mt-2 border-l-2 border-primary/40 pl-2 text-sm italic text-foreground/70">
          “{accommodations.note}”
        </p>
      )}
      {wantsHuman && (
        <p className="mt-2 text-xs font-medium text-foreground/80">
          They asked to be interviewed by a person. Arrange one — an AI-only process with no
          alternative is what this request exists to avoid.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Candidates are never asked to give a reason, so none is shown. Requesting an adjustment
        must not count against them.
      </p>
    </div>
  );
}

/**
 * How the screening was taken. Deliberately neutral wording and an explicit
 * caveat: every one of these has an ordinary explanation, and presenting them
 * as suspicion would penalise disabled candidates, people on poor connections,
 * and anyone who prepared notes — before it caught anyone dishonest.
 */
export function IntegrityNotes({ integrity }: { integrity: EmployerScreen["integrity"] }) {
  if (!integrity?.notes.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Info className="h-3.5 w-3.5" aria-hidden="true" /> How this was taken
      </p>
      <ul className="mt-2 space-y-1 text-sm text-foreground/80">
        {integrity.notes.map((n, i) => (
          <li key={i}>{n.detail}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Context only — these are not evidence of anything. Pasted text is often prepared notes,
        time away is often a notification or an assistive tool, and similar answers can be
        coincidence. Ask the candidate rather than assuming.
      </p>
    </div>
  );
}

export const REC_META: Record<string, { label: string; cls: string }> = {
  strong_yes: { label: "Strong yes", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20" },
  yes: { label: "Yes", cls: "bg-primary-soft text-primary ring-primary/20" },
  maybe: { label: "Maybe", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20" },
  no: { label: "No", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20" },
};

/** The recommendation chip, on its own — for table rows and summaries. */
export function RecommendationChip({ recommendation }: { recommendation: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        REC_META[recommendation]?.cls,
      )}
    >
      {REC_META[recommendation]?.label ?? recommendation}
    </span>
  );
}

/**
 * The AI screening scorecard, shared by the candidate drawer and the job's
 * screening board so both always show the same thing.
 */
export function ScreenScorecard({ evaluation }: { evaluation: ScreenEvaluation }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall</div>
          <div className="text-2xl font-semibold tabular-nums">
            {evaluation.overallScore}
            <span className="text-base text-muted-foreground">/100</span>
          </div>
        </div>
        <RecommendationChip recommendation={evaluation.recommendation} />
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">{evaluation.summary}</p>

      {evaluation.strengths.length > 0 && (
        <ScoreList title="Strengths" items={evaluation.strengths} tone="emerald" />
      )}
      {evaluation.concerns.length > 0 && (
        <ScoreList title="Concerns" items={evaluation.concerns} tone="amber" />
      )}

      {evaluation.perAnswer.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Per-question breakdown
          </summary>
          <div className="mt-2 space-y-2.5">
            {evaluation.perAnswer.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">{p.question}</p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">{p.score}</span>
                </div>
                {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ScoreList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber";
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                tone === "emerald" ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            <span className="text-foreground/80">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
