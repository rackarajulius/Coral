import { cn } from "@/lib/utils";

/** Bands are deliberately coarse — a 2-point gap isn't a meaningful difference. */
function matchTone(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

/**
 * How well a job fits, as one pill wherever a score is shown: Find Jobs and
 * AI Job Match used to show the same score two different ways.
 */
export default function MatchScore({
  score,
  reason,
  keyword,
  className,
}: {
  score: number;
  /** Why it scored so; shown on hover. */
  reason?: string | null;
  /** Scored by keyword overlap because the AI was unavailable. */
  keyword?: boolean;
  className?: string;
}) {
  return (
    <span
      title={reason ?? undefined}
      aria-label={`${keyword ? "Keyword match" : "Match"} score: ${score}%`}
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
        matchTone(score),
        className,
      )}
    >
      {score}% match
    </span>
  );
}

/** In a score's place while the AI is still scoring the job. */
export function MatchScorePending({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground animate-pulse motion-reduce:animate-none sm:text-[11px]",
        className,
      )}
    >
      Scoring…
    </span>
  );
}
