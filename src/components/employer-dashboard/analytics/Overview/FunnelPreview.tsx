import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getFunnel, type FunnelStage } from "@/lib/api/employerAnalytics";

/**
 * Condensed funnel for the Overview tab.
 *
 * Reach and pipeline are scaled separately, the same as the full Funnel tab:
 * reach is counted from when tracking began, pipeline covers all history, so a
 * shared bar scale would draw a conversion between two different periods.
 */
const FunnelPreview = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-analytics-funnel", 30],
    queryFn: () => getFunnel(30),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Couldn't load the funnel.</p>;
  }

  // One representative stage from reach, then the pipeline milestones.
  const reachHead = data.reach[0];
  const pipeline = data.pipeline.filter((s) =>
    ["Submitted", "Interviewed", "Hired"].includes(s.stage),
  );

  const rows: { stage: string; volume: number; conv: number | null; scale: number }[] = [];
  if (reachHead && reachHead.volume > 0) {
    rows.push({ stage: reachHead.stage, volume: reachHead.volume, conv: null, scale: reachHead.volume });
  }
  const pipeMax = pipeline[0]?.volume ?? 0;
  for (const s of pipeline) {
    rows.push({ stage: s.stage, volume: s.volume, conv: s.conversionFromPrev, scale: pipeMax });
  }

  if (rows.length === 0 || rows.every((r) => r.volume === 0)) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No views or applications yet. This fills in as candidates arrive.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const width = r.scale > 0 ? (r.volume / r.scale) * 100 : 0;
        return (
          <div key={r.stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{r.stage}</span>
              <span className="text-muted-foreground tabular-nums">
                {r.volume.toLocaleString()}
                {/* Null on the first stage of a group — nothing to convert from. */}
                {r.conv !== null && ` · ${r.conv}%`}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-md bg-secondary">
              <div
                className="h-full rounded-md bg-gradient-to-r from-orange-200 to-orange-400"
                style={{ width: `${r.scale > 0 ? Math.max(width, 2) : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Largest stage-to-stage fall in the pipeline, or null when there isn't one. */
export function biggestDrop(pipeline: FunnelStage[]): { stage: string; lostPct: number } | null {
  let worst: { stage: string; lostPct: number } | null = null;
  for (const s of pipeline) {
    if (s.conversionFromPrev === null) continue;
    const lost = Math.round((100 - s.conversionFromPrev) * 10) / 10;
    if (lost > 0 && (!worst || lost > worst.lostPct)) worst = { stage: s.stage, lostPct: lost };
  }
  return worst;
}

export default FunnelPreview;
