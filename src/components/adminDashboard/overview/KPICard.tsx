import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  icon: ReactNode;
  trend: number[];
  /** "negative" forces a red trend (for watch metrics like Suspended/Pending). */
  tone?: "auto" | "negative";
}

export function KPICard({ label, value, change, icon, trend, tone = "auto" }: KPICardProps) {
  const isPositive = change >= 0;
  const negative = tone === "negative" || change < 0;

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

      <div className="mt-4 flex items-center justify-between">
       <div
              className={cn(
             "flex items-center gap-1 text-xs font-medium",
                 negative
                ? "text-rose-600 dark:text-rose-400"
                 : "text-emerald-600 dark:text-emerald-400"
              )}
        >
                {negative ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
               <TrendingUp className="h-3.5 w-3.5" />
              )}
             <span>
              {isPositive ? "+" : ""}
              {change}%
                 </span>
                  <span className="text-muted-foreground font-normal ml-1">
                 vs last week
              </span>
          </div>
        {hasTrend && (
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              points={points}
              fill="none"
              stroke={negative ? "hsl(var(--destructive))" : "hsl(var(--success))"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
