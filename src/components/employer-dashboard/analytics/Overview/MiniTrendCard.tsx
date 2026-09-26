import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, Tooltip as RTooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  day: string;
  value: number;
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        pos ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? "+" : ""}
      {value}%
    </span>
  );
}

/**
 * One trend panel.
 *
 * Takes its series as a prop rather than reading a module-level mock, so the
 * only thing it can draw is data someone actually passed it.
 *
 * The delta is first-to-last change across the window, and is suppressed when
 * the first point is 0 — the old version computed `last / first - 1`, which
 * divides by zero and renders `Infinity%` for any metric starting from nothing.
 * That's every new employer.
 */
const MiniTrendCard = ({
  title,
  data,
  color,
  note,
  emptyLabel = "No data for this period yet.",
}: {
  title: string;
  data: TrendPoint[];
  color: string;
  /** Optional caveat, e.g. that a series only starts when tracking began. */
  note?: string;
  emptyLabel?: string;
}) => {
  const hasSeries = data.length > 1;
  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const delta = hasSeries && first > 0 ? Math.round((last / first - 1) * 100) : null;

  const id = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {delta !== null && <Delta value={delta} />}
      </div>

      {hasSeries ? (
        <div className="mt-3" style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={title}
                stroke={color}
                strokeWidth={2}
                fill={`url(#g-${id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 flex h-[140px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="px-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      )}

      {note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
    </Card>
  );
};

export default MiniTrendCard;
