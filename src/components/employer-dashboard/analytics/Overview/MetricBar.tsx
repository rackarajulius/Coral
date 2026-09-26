import { cn } from "@/lib/utils";

/**
 * A labelled bar.
 *
 * `max` exists because the values this now renders are real counts, not the
 * 0–100 index the mock used. Without it the bar treated the value as a
 * percentage directly, so a count of 3 drew a 3% sliver and a count of 150
 * overflowed the track.
 *
 * `valueLabel` lets the caller say "3 jobs" rather than a bare number, since a
 * count means nothing without its unit.
 */
const MetricBar = ({
  label,
  value,
  color,
  max,
  valueLabel,
}: {
  label: string;
  value: number;
  color: string;
  /** Scale reference. Defaults to 100 for percentage-style values. */
  max?: number;
  valueLabel?: string;
}) => {
  const ceiling = max && max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, (value / ceiling) * 100));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-foreground">{valueLabel ?? value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default MetricBar;
