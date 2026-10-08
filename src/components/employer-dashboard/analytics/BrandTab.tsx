
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Cell, Pie, XAxis, YAxis, PieChart,Tooltip as RTooltip, Bar, BarChart, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getBrand, getGeo, getSources } from '@/lib/api/employerAnalytics';
import BrandScoreCard from './BrandScoreCard';
import HiringResponsivenessCard from './HiringResponsivenessCard';
import { useAnalyticsRange } from './AnalyticsRange';
import EmployerLayout from '../Layout/EmployerLayout';
import _CountUpLib from 'react-countup';
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;

const BrandTab = () => {
  const { days } = useAnalyticsRange();
  const sourcesQuery = useQuery({
    queryKey: ['employer-analytics-sources', days],
    queryFn: () => getSources(days),
    retry: false,
  });
  const channels = sourcesQuery.data?.channels ?? [];

  const geoQuery = useQuery({
    queryKey: ['employer-analytics-geo', days],
    queryFn: () => getGeo(days),
    retry: false,
  });
  const places = geoQuery.data?.places ?? [];

  const brandQuery = useQuery({
    queryKey: ['employer-analytics-brand', days],
    queryFn: () => getBrand(days),
    retry: false,
  });

 const CHART_COLORS = [
  "steelblue",
  "slategray",
  "seagreen",
  "darkorange",
  "indianred",
];
  // Was seven fixed numbers with deltas attached. Video Engagement, Career
  // Page CTR and Visibility Score are gone: nothing tracks video plays, no
  // click is distinguishable as "career page", and a visibility score has no
  // inputs. The four that remain each have a real source.
  const brandKpis = brandQuery.data?.kpis ?? [];
  const topContent = brandQuery.data?.topContent ?? [];

  function Delta({ value }: { value: number }) {
    const pos = value >= 0;
    return (
      <span
        className={cn(
  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
  pos
    ? "bg-emerald-50 text-emerald-700"
    : "bg-red-50 text-red-700"
)}
      >
        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pos ? "+" : ""}
        {value}%
      </span>
    );
  };

  function ChartFrame({ children, height = 260 }: { children: React.ReactNode; height?: number }) {
    return (
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children as any}</ResponsiveContainer>
      </div>
    );
  };

  function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}
  
  return (
    <div >
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {brandQuery.isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[86px] rounded-xl" />)
          : brandKpis.map((b) => (
              <Card key={b.id} className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {b.label}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  {b.value === null ? (
                    // "Not measured yet" is not the same claim as zero.
                    <span className="text-xl font-bold text-muted-foreground">—</span>
                  ) : (
                    <CountUp
                      end={b.value}
                      enableScrollSpy
                      scrollSpyOnce
                      duration={2}
                      separator=","
                      className="text-xl font-bold"
                    />
                  )}
                  {b.delta !== null && <Delta value={b.delta} />}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  {b.definition}
                </p>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/*
          Replaces "Brand performance over time", which plotted brand,
          apps and funnel from a Math.sin() series with a daily/weekly/monthly
          selector that changed nothing. Two of those three series have no
          possible source; the score below is built only from things we measure.
        */}
        <div className="lg:col-span-2">
          <BrandScoreCard />
        </div>

        {/* The same figures candidates are shown, from the same endpoint —
            seen here first, so publishing them is an incentive rather than
            something an employer discovers from a candidate. */}
        <div className="lg:col-span-2">
          <HiringResponsivenessCard />
        </div>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Insights rail</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Top content</p>
              <div className="mt-2 space-y-2">
                {topContent.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {brandQuery.isLoading
                      ? "Loading…"
                      : "You haven't posted in this period. Posts you publish appear here, ranked by engagement."}
                  </p>
                ) : (
                  topContent.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <p className="line-clamp-2 text-sm font-medium">{c.excerpt}</p>
                      {/* The old panel showed "18,420 views" on every post.
                          Impressions aren't tracked, so only the interactions
                          we actually record are listed. */}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.likes} like{c.likes === 1 ? "" : "s"} · {c.comments} comment
                        {c.comments === 1 ? "" : "s"}
                        {c.bookmarks > 0 && ` · ${c.bookmarks} saved`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Audience by geography</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {geoQuery.data?.basis === "country"
              ? "Visitors by country"
              : "Visitors by region"}
          </p>
          {places.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {geoQuery.data?.note ?? "No visits recorded yet."}
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
                <div>
                  <ChartFrame height={220}>
                    <PieChart>
                      <Pie data={places} dataKey="sessions" nameKey="place" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {places.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(v: number, n: string) => [`${v} visit${v === 1 ? "" : "s"}`, n]}
                      />
                    </PieChart>
                  </ChartFrame>
                </div>
                <ul className="space-y-2 self-center text-xs">
                  {places.map((g, i) => (
                    <li key={g.place} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{g.place}</span>
                      <span className="ml-auto font-medium tabular-nums">{g.share}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Accuracy differs a lot between the two sources, so the panel
                  says which one produced these numbers. */}
              <p className="mt-2 text-[11px] text-muted-foreground">{geoQuery.data?.caveat}</p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Traffic sources</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Visits to your pages, by channel
          </p>
          {channels.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {sourcesQuery.data?.note ?? "No traffic recorded yet."}
            </p>
          ) : (
          <div className="mt-4">
            <ChartFrame height={220}>
              <BarChart data={channels}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} visit${v === 1 ? "" : "s"}`, "Visits"]}
                />
                <Bar dataKey="sessions" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartFrame>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {sourcesQuery.data?.caveat}
            </p>
          </div>
          )}
        </Card>
      </div>
    </div>
    </div>
  )
}

export default BrandTab;
