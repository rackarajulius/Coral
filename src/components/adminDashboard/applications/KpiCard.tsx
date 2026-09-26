import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";


interface KpiCardProps {
  label: string;
  value: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
}

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-card hover:shadow-md
     transition-all duration-300">
      <p className="text-xs font-medium uppercase text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground tracking-tight animate-count-up">{value}</p>
      {trend && (
        <div className={cn(
           "flex items-center gap-1 mt-1 text-xs font-medium",
                       trend.direction === "up" && "text-emerald-600 dark:text-emerald-400",
                      trend.direction === "down" && "text-rose-600 dark:text-rose-400",
                      trend.direction === "neutral" && "text-muted-foreground"
        )}>
          {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
           {trend.direction === "down" && <TrendingDown className="h-3 w-3" />}
           {trend.direction === "neutral" && <Minus className="h-3 w-3" />}
           {trend.value}
        </div>
      )}
    </div>
  );
}
