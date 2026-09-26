import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { competencyLabel } from "@/data/interview-coach/constants";
import type { SessionReport } from "@/data/interview-coach/types";

const tone = (v: number) =>
  v >= 75 ? "text-emerald-400" : v >= 55 ? "text-amber-400" : "text-rose-400";

export default function CompetencyCards({ report }: { report: SessionReport }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {report.competencies.map((c) => (
        <div key={c.id} className="rounded-2xl border border-ink/10 bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-dim">
            {competencyLabel(c.id)}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("tabular font-display text-3xl font-semibold", tone(c.score))}>
              {c.score}
            </span>
            {c.trendVsPrev != null && (
              <span
                className={cn(
                  "tabular flex items-center gap-0.5 text-xs font-medium",
                  c.trendVsPrev > 0 && "text-emerald-400",
                  c.trendVsPrev < 0 && "text-rose-400",
                  c.trendVsPrev === 0 && "text-ink-dim",
                )}
              >
                {c.trendVsPrev > 0 ? (
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                ) : c.trendVsPrev < 0 ? (
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Minus className="h-3 w-3" aria-hidden="true" />
                )}
                {c.trendVsPrev > 0 ? "+" : ""}
                {c.trendVsPrev}
              </span>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">{c.insight}</p>
        </div>
      ))}
    </div>
  );
}
