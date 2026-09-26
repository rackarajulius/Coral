import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Sparkline from "./Sparkline";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKpi, type Kpi } from "@/lib/api/employerAnalytics";
import _CountUpLib from "react-countup";
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;

/** Percent change vs the previous window. Rendered only when one exists. */
function Delta({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        pos
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? "+" : ""}
      {value}%
    </span>
  );
}

/**
 * One headline metric.
 *
 * `value: null` renders "—" rather than 0: "we have no measurement" and "we
 * measured zero" are different claims, and the second is the kind of invented
 * certainty this dashboard used to be full of. Likewise a missing `delta`
 * shows nothing at all rather than a fabricated 0%.
 */
const KpiTile = ({ k, trend }: { k: Kpi; trend?: number[] }) => {
  const hasValue = k.value !== null;
  const hasTrend = !!trend && trend.length > 1;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="group rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
        <div className="flex items-start justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="cursor-help text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">{k.definition}</TooltipContent>
          </Tooltip>
          {/* A sparkline needs at least two points to describe a direction. */}
          {hasTrend && <Sparkline data={trend} positive={(k.delta ?? 0) >= 0} />}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          {hasValue ? (
            <>
              <CountUp
                end={k.value as number}
                enableScrollSpy
                scrollSpyOnce
                duration={2}
                separator=","
                className="text-2xl font-bold tracking-tight text-foreground"
              />
              {k.unit === "days" && <span className="text-muted-foreground">d</span>}
              {k.unit === "percent" && <span className="text-muted-foreground">%</span>}
            </>
          ) : (
            <span className="text-2xl font-bold tracking-tight text-muted-foreground">
              {formatKpi(k)}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          {k.delta !== null ? (
            <Delta value={k.delta} />
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {hasValue ? "No earlier period to compare" : "Not measured yet"}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default KpiTile;
