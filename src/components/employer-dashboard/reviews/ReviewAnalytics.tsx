import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid,
} from "recharts";
import { departmentBreakdown, geoBreakdown, ratingDistribution, reviewSources, volumeTrend } from "@/data/employer/reviews/reviews";
import { Star } from "lucide-react";

const ReviewAnalytics = () => {
    const [timeRange, setTimeRange] = useState("90d");

   const CHART_COLORS = [
  "#3b82f6", // Blue
  "#f97316", // Orange
  "#64748b", // Slate
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#a855f7", // Purple
];

    function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
      return (
        <div className={cn("rounded-xl border border-gray-300 bg-card", className)}>{children}</div>
      );
    };

    
 function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
};
  return (
    <section className="mt-6">
          <SectionHeader
            title="Review Analytics"
            description="Volume, ratings, and source distribution."
            action={
              <Tabs value={timeRange} onValueChange={setTimeRange}>
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs h-6">7D</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs h-6">30D</TabsTrigger>
                  <TabsTrigger value="90d" className="text-xs h-6">90D</TabsTrigger>
                  <TabsTrigger value="12m" className="text-xs h-6">12M</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Review Volume & Sentiment</h3>
                  <p className="text-xs text-muted-foreground">Monthly reviews with sentiment trend</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={volumeTrend}>
  <defs>
    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
    </linearGradient>
  </defs>

  <CartesianGrid
    strokeDasharray="3 3"
    stroke="#e5e7eb"
    vertical={false}
  />

  <XAxis
    dataKey="month"
    tick={{ fontSize: 11, fill: "#64748b" }}
    axisLine={false}
    tickLine={false}
  />

  <YAxis
    tick={{ fontSize: 11, fill: "#64748b" }}
    axisLine={false}
    tickLine={false}
  />

  <RTooltip
    contentStyle={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      fontSize: 12,
    }}
  />

  <Area
    type="monotone"
    dataKey="reviews"
    stroke="#f97316"
    strokeWidth={2}
    fill="url(#rev)"
  />

  <Line
    type="monotone"
    dataKey="sentiment"
    stroke="#f97316"
    strokeWidth={2}
    dot={false}
  />
</AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-sm font-semibold mb-1">Rating Distribution</h3>
              <p className="text-xs text-muted-foreground mb-4">1,482 total ratings</p>
              <div className="space-y-3">
                {ratingDistribution.map((r) => (
                  <div key={r.stars} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 w-12">
                      <span className="text-xs font-medium tabular-nums">{r.stars}</span>
                      <Star className="h-3 w-3 fill-accent text-accent" />
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-400 transition-all"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{r.count} · {r.pct}%</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-sm font-semibold mb-1">Review Sources</h3>
              <p className="text-xs text-muted-foreground mb-4">By reviewer type</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={reviewSources} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {reviewSources.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
               
               <RTooltip
  contentStyle={{
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 12,
  }}
/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {reviewSources.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-medium tabular-nums">{s.value}%</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-sm font-semibold mb-1">Geographic Breakdown</h3>
              <p className="text-xs text-muted-foreground mb-4">Reviews by region</p>
             <ResponsiveContainer width="100%" height={220}>
  <BarChart data={geoBreakdown} layout="vertical" margin={{ left: 20 }}>
    <CartesianGrid
      horizontal={false}
      stroke="#e5e7eb"
    />

    <XAxis
      type="number"
      tick={{ fontSize: 11, fill: "#64748b" }}
      axisLine={false}
      tickLine={false}
    />

    <YAxis
      type="category"
      dataKey="region"
      tick={{ fontSize: 11, fill: "#64748b" }}
      axisLine={false}
      tickLine={false}
      width={100}
    />

    <RTooltip
      contentStyle={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        fontSize: 12,
      }}
  />

    <Bar dataKey="reviews" fill="#f97316" radius={[0, 4, 4, 0]} />
    </BarChart>
</ResponsiveContainer>
            </Panel>

            <Panel className="p-5">
              <h3 className="text-sm font-semibold mb-1">Department Breakdown</h3>
              <p className="text-xs text-muted-foreground mb-4">Reviews per department</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={departmentBreakdown}>
                 <CartesianGrid
  strokeDasharray="3 3"
  vertical={false}
  stroke="#e5e7eb"
/>

<XAxis
  dataKey="dept"
  tick={{ fontSize: 10, fill: "#64748b" }}
  axisLine={false}
  tickLine={false}
  interval={0}
  angle={-25}
  textAnchor="end"
  height={50}
/>

<YAxis
  tick={{ fontSize: 11, fill: "#64748b" }}
  axisLine={false}
  tickLine={false}
/>

<RTooltip
  contentStyle={{
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 12,
  }}
/>

<Bar
  dataKey="reviews"
  fill="#f97316"
  radius={[4, 4, 0, 0]}
/>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        </section>
  );
};

export default ReviewAnalytics;
