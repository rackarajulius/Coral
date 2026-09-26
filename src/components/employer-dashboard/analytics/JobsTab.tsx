import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { getJobsAnalytics, getSources } from '@/lib/api/employerAnalytics';
import { Bookmark, CheckCircle2, ChevronDown, Clock, Download, Eye, FileText, MousePointerClick, Search, Star, Users } from 'lucide-react';
import React, { useMemo } from 'react'
import { CartesianGrid, Cell, Pie, XAxis, YAxis, PieChart,Tooltip as RTooltip, ResponsiveContainer, Bar, BarChart } from 'recharts';
import JobsTable from './JobsTable';
import { cn } from '@/lib/utils';
import _CountUpLib from 'react-countup';
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;



const JobsTab = () => {

const CHART_COLORS = [
  "royalblue",
  "slategray",
  "seagreen",
  "orange",
  "crimson",
];
  const jobsQuery = useQuery({
    queryKey: ["employer-analytics-jobs", 30],
    queryFn: () => getJobsAnalytics(30),
    retry: false,
  });
  const topJobs = jobsQuery.data?.rows ?? [];

  const sourcesQuery = useQuery({
    queryKey: ['employer-analytics-sources', 30],
    queryFn: () => getSources(30),
    retry: false,
  });
  const channels = sourcesQuery.data?.channels ?? [];

  const totals = useMemo(
    () =>
      topJobs.reduce(
        (acc, j) => ({
          views: acc.views + j.views,
          apps: acc.apps + j.applications,
          interviews: acc.interviews + j.interviews,
          hires: acc.hires + j.hires,
        }),
        { views: 0, apps: 0, interviews: 0, hires: 0 },
      ),
    [topJobs],
  );

  // "Apply Clicks" and "Qualified" are gone: clicks aren't attributed per job,
  // and "Qualified" had no definition anywhere in the codebase.
  const tiles = [
    { label: "Views", value: totals.views.toLocaleString(), icon: Eye },
    { label: "Applications", value: totals.apps.toLocaleString(), icon: FileText },
    { label: "Interviews", value: totals.interviews.toLocaleString(), icon: Users },
    { label: "Hires", value: totals.hires.toLocaleString(), icon: CheckCircle2 },
  ];

  function ChartFrame({ children, height = 260 }: { children: React.ReactNode; height?: number }) {
    return (
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children as any}</ResponsiveContainer>
      </div>
    );
  };

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {tiles.map((t) => (
              <Card key={t.label} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </div>
                <CountUp
                 end={Number(t.value.replace(/[,%d]/g, "").replace(/,/g, ""))}
                   enableScrollSpy
                   scrollSpyOnce
                    duration={2}
                    separator=","
                 className="mt-2 text-xl font-bold"/>
              </Card>
            ))}
          </div>
    
          <Section
            title="Top performing jobs"
            description="Click a row to drill into detailed analytics."
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search jobs" className="h-8 w-56 pl-8 text-xs" />
                </div>
              </div>
            }
          >
            <Card>
              <JobsTable />
            </Card>
          </Section>
    
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Applications by role</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                How far applicants got, per job
              </p>
              <div className="mt-4">
                <ChartFrame height={200}>
                  <BarChart data={[...topJobs]}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="title" hide />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {/* Real pipeline fields. The old chart plotted "qualified",
                        which no data source ever defined. */}
                    <Bar dataKey="applications" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="interviews" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="hires" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartFrame>
              </div>
            </Card>
    
            <Card className="p-5">
              <h3 className="text-sm font-semibold">View-to-application rate</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                How many viewers went on to apply
              </p>
              <div className="mt-4 space-y-3">
                {topJobs.slice(0, 5).map((j) => (
                  <div key={j.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="line-clamp-1 font-medium">{j.title}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {/* Null when nobody viewed it — a dash, not 0%. */}
                        {j.conversion === null ? "—" : `${j.conversion}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-orange-400"
                        style={{ width: `${Math.min(j.conversion ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {topJobs.length === 0 && (
                  <p className="text-xs text-muted-foreground">No jobs to compare yet.</p>
                )}
              </div>
            </Card>
    
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Where visitors came from</h3>
              {/* Was "Hires by attributed source" — hires are never attributed
                  to a channel, and the pie was rendering fixed mock shares. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Visits to your pages, by channel
              </p>
              {channels.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  {sourcesQuery.data?.note ?? "No traffic recorded yet."}
                </p>
              ) : (
                <>
                  <div className="mt-4">
                    <ChartFrame height={200}>
                      <PieChart>
                        <Pie
                          data={channels}
                          dataKey="sessions"
                          nameKey="channel"
                          innerRadius={45}
                          outerRadius={75}
                        >
                          {channels.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip
                          formatter={(v: number, n: string) => [`${v} visit${v === 1 ? "" : "s"}`, n]}
                        />
                      </PieChart>
                    </ChartFrame>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {sourcesQuery.data?.caveat}
                  </p>
                </>
              )}
            </Card>
          </div>
        </div>
  )
}

export default JobsTab;
