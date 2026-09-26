import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Info, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getBrandScore, type ScoreItem } from "@/lib/api/employerAnalytics";

function Row({ item }: { item: ScoreItem }) {
  const body = (
    <div className="flex items-start gap-2 py-1">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          !item.applicable
            ? "bg-muted text-muted-foreground"
            : item.done
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
        )}
      >
        {item.applicable ? (
          item.done ? (
            <Check className="h-2.5 w-2.5" aria-hidden="true" />
          ) : null
        ) : (
          <Minus className="h-2.5 w-2.5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            item.applicable && item.done ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {item.label}
        </span>
        {item.hint && <span className="block text-[11px] text-muted-foreground">{item.hint}</span>}
        {/* Not applicable is a real state, not a failure — say so. */}
        {!item.applicable && (
          <span className="block text-[11px] text-muted-foreground">
            Nothing to measure yet — not counted.
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {item.points}
      </span>
    </div>
  );

  return item.link && item.applicable && !item.done ? (
    <Link to={item.link} className="block rounded hover:bg-secondary/40">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * The employer brand score, with its full working shown.
 *
 * The breakdown isn't optional detail — it IS the feature. A bare "82/100" is
 * what the old dashboard displayed, and it meant nothing because nobody could
 * see what produced it or what to do about it.
 */
export function BrandScoreCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-brand-score"],
    queryFn: getBrandScore,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-[420px] rounded-xl" />;
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <p className="text-sm text-destructive">Couldn't load your brand score.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              Employer brand score
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[320px] text-xs">{data.method}</TooltipContent>
              </Tooltip>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.earned} of {data.possible} points that apply to you
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold tabular-nums">
              {data.score === null ? "—" : data.score}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>

        {data.nextSteps.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Biggest wins available
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-foreground/80">
              {data.nextSteps.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {data.components.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{c.label}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {c.earned}/{c.possible}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.description}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-orange-400"
                  style={{ width: `${c.possible > 0 ? (c.earned / c.possible) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-2">
                {c.items.map((i) => (
                  <Row key={i.label} item={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BrandScoreCard;
