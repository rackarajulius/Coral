import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getFunnel, type FunnelStage } from "@/lib/api/employerAnalytics";

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

/**
 * One funnel group.
 *
 * Bars are scaled to the group's own first stage, not to a global maximum:
 * reach and pipeline are measured over different periods, so a shared scale
 * would draw a comparison that isn't there.
 */
function StageList({ stages }: { stages: FunnelStage[] }) {
  const max = stages[0]?.volume ?? 0;
  return (
    <div className="mt-4 space-y-2">
      {stages.map((s, i) => {
        const width = max > 0 ? (s.volume / max) * 100 : 0;
        return (
          <div key={s.stage} className="rounded-lg p-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {i + 1}. {s.stage}
              </span>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="tabular-nums">{s.volume.toLocaleString()}</span>
                <span className="tabular-nums">
                  {s.conversionFromPrev === null ? "—" : `${s.conversionFromPrev}% of previous`}
                </span>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-md bg-secondary">
              <div
                className="h-full rounded-md bg-gradient-to-r from-orange-200 to-orange-400 transition-all"
                style={{ width: `${max > 0 ? Math.max(width, 2) : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const FunnelTab = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-analytics-funnel", 30],
    queryFn: () => getFunnel(30),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">Couldn't load your funnel.</p>
      </Card>
    );
  }

  const noPipeline = data.pipeline.every((s) => s.volume === 0);
  const noReach = data.reach.every((s) => s.volume === 0);

  return (
    <div className="grid gap-6">
      {/*
        Two separate cards on purpose. Reach comes from page tracking that
        started recently; pipeline comes from application records covering all
        history. Drawing them as one funnel would imply a conversion rate
        between two things counted over different periods.
      */}
      <Card className="p-6">
        <h2 className="text-base font-semibold">Reach</h2>
        <p className="text-xs text-muted-foreground">
          How many people saw your roles and started applying.
        </p>
        {noReach ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No views or clicks recorded in this period yet.
          </p>
        ) : (
          <StageList stages={data.reach} />
        )}
        <Note>{data.notes.reach}</Note>
        <Note>{data.notes.applyStarted}</Note>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">Hiring pipeline</h2>
        <p className="text-xs text-muted-foreground">
          What happened to applications you received in this period.
        </p>
        {noPipeline ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No applications in this period.
          </p>
        ) : (
          <StageList stages={data.pipeline} />
        )}
        <Note>
          Stages are cumulative: someone who reached Interviewed is also counted in
          Submitted and Screened.
        </Note>
      </Card>
    </div>
  );
};

export default FunnelTab;
