import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2 } from "lucide-react";
import { getScreenFeedback, screenFeedbackReady, type ScreenFeedbackResult } from "@/lib/api/aiScreen";
import { cn } from "@/lib/utils";

const COMPETENCY_LABEL: Record<string, string> = {
  communication: "Communication",
  confidence: "Confidence",
  technicalDepth: "Technical depth",
  problemSolving: "Problem solving",
  structure: "Structure",
};

const READINESS_LABEL: Record<string, string> = {
  "not-ready": "Early days",
  "getting-there": "Getting there",
  ready: "Interview-ready",
  strong: "Strong",
};

/**
 * The candidate's coaching feedback from a completed live screening.
 *
 * Shows no overall score on purpose: the employer forms their own separate
 * judgement, and a number here would be read as their verdict. The framing has
 * to keep those two things apart.
 */
export function ScreenFeedbackPanel({ screenId }: { screenId: string }) {
  const { data, isLoading, isError } = useQuery<ScreenFeedbackResult>({
    queryKey: ["screen-feedback", screenId],
    queryFn: () => getScreenFeedback(screenId),
    retry: false,
    // The report is written just after the interview ends, so landing here can
    // beat it by a second or two. Poll briefly rather than telling someone to
    // come back for something that's about to appear.
    refetchInterval: (query) =>
      query.state.data?.available === false && query.state.dataUpdateCount < 10 ? 3000 : false,
  });

  if (isLoading) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparing your feedback…
      </div>
    );
  }

  // No feedback is a normal state, not an error — say which, plainly.
  if (isError || !data) {
    return (
      <p className="mt-4 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Your feedback isn't available right now. Try again in a moment.
      </p>
    );
  }
  if (!screenFeedbackReady(data)) {
    return (
      <p className="mt-4 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {data.reason === "not_started"
          ? "You didn't start this interview, so there's no feedback to show."
          : "Your feedback is still being prepared. Check back shortly."}
      </p>
    );
  }

  const hasContent =
    data.competencies.length > 0 ||
    data.strengths.length > 0 ||
    data.weaknesses.length > 0 ||
    data.focusAreas.length > 0;

  if (!hasContent) {
    return (
      <p className="mt-4 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        There wasn't enough in this interview to give you useful feedback.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
          Your feedback
        </h2>
        {READINESS_LABEL[data.readiness] && (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {READINESS_LABEL[data.readiness]}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        This is coaching for you, from your own answers. It is not the employer's decision, and they
        don't see it.
      </p>

      {data.competencies.length > 0 && (
        <div className="mt-5 space-y-3">
          {data.competencies.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {COMPETENCY_LABEL[c.id] ?? c.id}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{c.score}/100</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.score >= 70 ? "bg-emerald-500" : c.score >= 45 ? "bg-amber-500" : "bg-rose-500",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, c.score))}%` }}
                />
              </div>
              {c.insight && <p className="mt-1.5 text-xs text-muted-foreground">{c.insight}</p>}
            </div>
          ))}
        </div>
      )}

      {data.strengths.length > 0 && <Bullets title="What worked" items={data.strengths} tone="emerald" />}
      {data.weaknesses.length > 0 && <Bullets title="What to work on" items={data.weaknesses} tone="amber" />}
      {data.repeatedMistakes.length > 0 && (
        <Bullets title="Patterns to watch" items={data.repeatedMistakes} tone="amber" />
      )}
      {data.focusAreas.length > 0 && <Bullets title="Focus next" items={data.focusAreas} tone="primary" />}
    </div>
  );
}

function Bullets({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "primary";
}) {
  const dot =
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-primary";
  return (
    <div className="mt-5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            <span className="text-foreground/80">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
