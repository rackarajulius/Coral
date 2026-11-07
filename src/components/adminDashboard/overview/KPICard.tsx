import { ReactNode } from "react";
import { Minus, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  /** % change over the snapshot window; null/undefined until history exists, and then nothing is shown. */
  change?: number | null;
  icon: ReactNode;
  trend?: number[];
  /**
   * "negative" is for watch metrics (Suspended, Pending) where a rise is bad:
   * it flips which direction reads red. It used to force red and a falling
   * arrow regardless, so "+0%" sat beside a down-arrow.
   */
  tone?: "auto" | "negative";
}

export function KPICard({ label, value, change = null, icon, trend = [], tone = "auto" }: KPICardProps) {
  const hasChange = change != null;
  // The arrow follows the number; the colour says whether that is good.
  const direction = !hasChange || change === 0 ? "flat" : change > 0 ? "up" : "down";
  const isPositive = hasChange && change >= 0;
  const bad = direction !== "flat" && (tone === "negative" ? direction === "up" : direction === "down");
  const good = direction !== "flat" && !bad;
  const DirectionIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  // Mini sparkline (needs at least 2 points to draw a line)
  const hasTrend = trend.length > 1;
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = hasTrend
    ? trend
        .map((v, i) => {
          const x = (i / (trend.length - 1)) * width;
          const y = height - ((v - min) / range) * height;
          return `${x},${y}`;
        })
        .join(" ")
    : "";

  return (
    <div className="group rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-card-foreground animate-count-up">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
          {icon}
        </div>
      </div>

      {(hasChange || hasTrend) && (
      <div className="mt-4 flex items-center justify-between">
        {hasChange ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              bad ? "text-rose-600 dark:text-rose-400" : good ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            <DirectionIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isPositive && change !== 0 ? "+" : ""}
              {change}%
            </span>
            <span className="text-muted-foreground font-normal ml-1">vs last week</span>
          </div>
        ) : (
          <span />
        )}
        {hasTrend && (
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              points={points}
              fill="none"
              stroke={bad ? "hsl(var(--destructive))" : good ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      )}
    </div>
  );
}
