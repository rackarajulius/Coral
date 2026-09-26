import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getFunnel, getInsights, getOverview, getTalent } from '@/lib/api/employerAnalytics';
import KpiTile from './KpiTile';
import { AlertTriangle, ArrowRight, Briefcase, Globe2, LayoutDashboard, Megaphone, Sparkles, Filter as FunnelIcon, } from 'lucide-react';
import { cn } from '@/lib/utils';
import InsightCard from './InsightCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MiniTrendCard, { type TrendPoint } from './MiniTrendCard';
import JobsTable from '../JobsTable';
import FunnelPreview, { biggestDrop } from './FunnelPreview';
import MetricBar from './MetricBar';

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "brand", label: "Employer Brand", icon: Megaphone },
  { id: "jobs", label: "Job Performance", icon: Briefcase },
  { id: "funnel", label: "Candidate Funnel", icon: FunnelIcon },
  { id: "talent", label: "Talent Intelligence", icon: Globe2 },
] as const; 

type TabId = (typeof TABS)[number]["id"];

const OverviewTab = ({ onJump }: { onJump: (t: TabId) => void }) => {
  const overviewQuery = useQuery({
    queryKey: ["employer-analytics-overview", 30],
    queryFn: () => getOverview(30),
    retry: false,
  });
  const insightsQuery = useQuery({
    queryKey: ["employer-analytics-insights"],
    queryFn: getInsights,
    retry: false,
  });

  /**
   * Sparkline series for a KPI, or undefined when there's no series to draw.
   * Only the event-derived metrics have a daily history; the rest deliberately
   * render without a sparkline rather than with a flat invented line.
   */
  const trendFor = (id: string): number[] | undefined => {
    const t = overviewQuery.data?.trend ?? [];
    // Only the event-derived series depend on the nightly rollup; guarding them
    // separately, because applications and followers come from timestamps that
    // already exist and shouldn't wait on it.
    if (id === "profileViews") return t.length > 1 ? t.map((d) => d.profileViews) : undefined;
    if (id === "jobViews") return t.length > 1 ? t.map((d) => d.jobViews) : undefined;
    if (id === "applications") {
      const a = overviewQuery.data?.applicationsTrend ?? [];
      return a.length > 1 ? a.map((d) => d.count) : undefined;
    }
    if (id === "followers") {
      const f = overviewQuery.data?.followersTrend ?? [];
      // A flat line at a real number is honest; a flat line at zero says
      // nothing, so don't draw one for a company with no followers yet.
      return f.length > 1 && f.some((d) => d.count > 0) ? f.map((d) => d.count) : undefined;
    }
    return undefined;
  };

  /**
   * A named daily series for the Performance Snapshot panels.
   *
   * Returns [] rather than a zero-filled placeholder when the source is empty,
   * so the panel shows "not enough data yet" instead of a flat line implying
   * a measured zero every day.
   */
  const series = (id: string): TrendPoint[] => {
    const d = overviewQuery.data;
    if (!d) return [];
    if (id === "applications") return d.applicationsTrend.map((p) => ({ day: p.day, value: p.count }));
    if (id === "followers") return d.followersTrend.map((p) => ({ day: p.day, value: p.count }));
    if (id === "jobViews") return d.trend.map((p) => ({ day: p.day, value: p.jobViews }));
    if (id === "profileViews") return d.trend.map((p) => ({ day: p.day, value: p.profileViews }));
    return [];
  };

  // Shared cache key with FunnelPreview, so the header and the chart below it
  // always describe the same fetch rather than two independent ones.
  const funnelQuery = useQuery({
    queryKey: ["employer-analytics-funnel", 30],
    queryFn: () => getFunnel(30),
    retry: false,
  });
  const worstDrop = funnelQuery.data ? biggestDrop(funnelQuery.data.pipeline) : null;

  const talentQuery = useQuery({
    queryKey: ["employer-analytics-talent"],
    queryFn: getTalent,
    retry: false,
  });
  const topSkills = (talentQuery.data?.skills ?? []).slice(0, 3);
  /** Shared ceiling so demand and supply bars are read against each other. */
  const skillScale = Math.max(1, ...topSkills.flatMap((s) => [s.demand, s.supply]));

  const trackingNote = overviewQuery.data?.trackingSince
    ? `Counted from ${new Date(overviewQuery.data.trackingSince).toLocaleDateString()}, when tracking began.`
    : undefined;


const CHART_COLORS = [
  "#f97316", // primary orange
  "#3b82f6", // applications
  "#22c55e", // hired
  "#a855f7", // interviews
  "#ef4444", // rejected
];

function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};
    function Card({ className, children }: { className?: string; children: React.ReactNode }) {
      return (
        <div className={cn("rounded-xl border border-gray-300 bg-card shadow-card", className)}>
          {children}
        </div>
      );
    };

  return (
    <div className="grid gap-6">
          {overviewQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[132px] rounded-xl" />
              ))}
            </div>
          ) : overviewQuery.isError ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm text-destructive">
              Couldn't load your analytics.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(overviewQuery.data?.kpis ?? []).map((k) => (
                  <KpiTile key={k.id} k={k} trend={trendFor(k.id)} />
                ))}
              </div>
              {/* Tracking started recently, so a short window is the whole
                  history — say so rather than letting it read as a decline. */}
              {overviewQuery.data?.trackingSince && (
                <p className="text-xs text-muted-foreground">
                  View and click tracking began{" "}
                  {new Date(overviewQuery.data.trackingSince).toLocaleDateString()}. Applications
                  and hires cover your full history.
                </p>
              )}
            </>
          )}
    
          {/*
            Replaces the old "AI Insights Center" and "Alerts" cards, which
            rendered four hardcoded findings with invented confidence scores.
            These come from deterministic rules over real records — see
            backend InsightsService.
          */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Needs your attention</h2>
                <p className="text-xs text-muted-foreground">
                  Things we can see in your data right now.
                </p>
              </div>
              {insightsQuery.data && insightsQuery.data.insights.length > 0 && (
                <Badge variant="outline" className="text-[11px]">
                  {insightsQuery.data.insights.length}
                </Badge>
              )}
            </div>

            {insightsQuery.isLoading ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : insightsQuery.isError ? (
              <p className="mt-4 text-sm text-destructive">Couldn't load insights.</p>
            ) : (insightsQuery.data?.insights.length ?? 0) === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing needs attention right now. This fills in as applications,
                screenings and interviews come through.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {insightsQuery.data?.insights.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            )}
          </Card>
    
          {/*
            The old four panels were "Employer Brand Trend", "Hiring
            Performance", "Application Growth" and "Funnel Conversion", all
            drawn from a Math.sin() series. Brand score doesn't exist, and daily
            hires can't be derived — Application.status holds only the current
            state, with no history of when it changed. These four are the ones
            with a real daily series behind them.
          */}
          <Section
            title="Performance Snapshot"
            description="Daily trends over the last 30 days."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <MiniTrendCard
                title="Applications"
                data={series("applications")}
                color={CHART_COLORS[1]}
                emptyLabel="No applications yet."
              />
              <MiniTrendCard
                title="Followers"
                data={series("followers")}
                color={CHART_COLORS[2]}
                emptyLabel="No followers yet."
              />
              <MiniTrendCard
                title="Job Views"
                data={series("jobViews")}
                color={CHART_COLORS[0]}
                note={trackingNote}
                emptyLabel="Not enough tracking data yet — this needs a couple of days."
              />
              <MiniTrendCard
                title="Profile Views"
                data={series("profileViews")}
                color={CHART_COLORS[3]}
                note={trackingNote}
                emptyLabel="Not enough tracking data yet — this needs a couple of days."
              />
            </div>
          </Section>
    
          {/* The description was a hardcoded "Largest drop-off: Apply Clicks →
              Started (-40%)" — a specific finding about a specific employer,
              shown to every employer. It's computed now, or omitted. */}
          <Section
            title="Candidate Funnel Preview"
            description={
              worstDrop
                ? `Largest drop-off: ${worstDrop.stage} (${worstDrop.lostPct}% don't reach it).`
                : "Where candidates fall out between stages."
            }
            action={
              <Button variant="default" size="sm" className="gap-1 text-xs" onClick={() => onJump("funnel")}>
                View full funnel <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <Card className="p-5">
              <FunnelPreview />
            </Card>
          </Section>
    
          <Section
            title="Top Performing Jobs"
            action={
              <Button variant="default" size="sm" className="gap-1 text-xs" onClick={() => onJump("jobs")}>
                View job analytics <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <Card>
              <JobsTable compact />
            </Card>
          </Section>
    
          <Section
            title="Talent Market Highlights"
            action={
              <Button variant="default" size="sm" className="gap-1 text-xs" onClick={() => onJump("talent")}>
                View talent intelligence <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          >
            {talentQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[168px] rounded-xl" />
                ))}
              </div>
            ) : topSkills.length === 0 ? (
              <Card className="p-6">
                <p className="text-center text-sm text-muted-foreground">
                  {talentQuery.isError
                    ? "Couldn't load skill data."
                    : "Add skills to your active job posts to see how many candidates here list them."}
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {topSkills.map((s) => (
                  <Card key={s.skill} className="p-5">
                    {/* Was "Emerging skill" — nothing measures whether a skill
                        is emerging. It's a skill from their own job posts. */}
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      You're hiring for
                    </p>
                    <p className="mt-2 text-lg font-semibold">{s.skill}</p>
                    <div className="mt-3 space-y-2">
                      {/* Both bars share one scale so their lengths are
                          comparable — the point of the card is the gap. */}
                      <MetricBar
                        label="Live jobs asking for it"
                        value={s.demand}
                        max={skillScale}
                        valueLabel={String(s.demand)}
                        color="bg-orange-400"
                      />
                      <MetricBar
                        label="Candidates listing it"
                        value={s.supply}
                        max={skillScale}
                        valueLabel={String(s.supply)}
                        color="bg-slate-400"
                      />
                    </div>
                    {s.supply === 0 && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Nobody here lists this yet.
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
            {talentQuery.data?.note && (
              <p className="text-[11px] text-muted-foreground">{talentQuery.data.note}</p>
            )}
          </Section>
        </div>
  )
};
export default OverviewTab;
