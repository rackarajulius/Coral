import { cn } from "@/lib/utils";

interface PipelineStatsProps {
  /** The whole matching pool, pre-formatted ("5,000+") when it's a floor. */
  totalMatched: number | string;
  saved: number;
  inPipeline: number;
  interviewing: number;
}

export function PipelineStats({
  totalMatched,
  saved,
  inPipeline,
  interviewing,
}: PipelineStatsProps) {
  const stats = [
    { label: "Matched",      value: totalMatched,  color: "text-foreground" },
    { label: "Saved",        value: saved,          color: "text-foreground" },
    { label: "In Pipeline",  value: inPipeline,     color: "text-accent" },
    { label: "Interviewing", value: interviewing,   color: "text-orange-500 dark:text-orange-400" },
  ];

  return (
    <div className="mb-3 flex divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-1 flex-col px-4 py-3">
          <span className={cn("text-xl font-semibold tabular-nums", stat.color)}>
            {stat.value}
          </span>
          <span className="text-[11px] text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
