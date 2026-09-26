import { sentimentByDept, sentimentTrend } from "@/data/employer/reviews/reviews";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid,
} from "recharts";


const SentimentIntelligence = () => {
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
              <SectionHeader title="Sentiment Intelligence" description="AI-powered sentiment analysis across reviews and departments." />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Panel className="p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold mb-1">Sentiment Trend</h3>
                  <p className="text-xs text-muted-foreground mb-4">Stacked monthly distribution</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={sentimentTrend}>
                    <CartesianGrid
  strokeDasharray="3 3"
  vertical={false}
  stroke="#e5e7eb"
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
  dataKey="positive"
  stackId="1"
  stroke="#10b981"
  fill="#10b981"
  fillOpacity={0.7}
/>

<Area
  type="monotone"
  dataKey="neutral"
  stackId="1"
  stroke="#94a3b8"
  fill="#94a3b8"
  fillOpacity={0.6}
/>

<Area
  type="monotone"
  dataKey="negative"
  stackId="1"
  stroke="#ef4444"
  fill="#ef4444"
  fillOpacity={0.7}
/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>
    
                <Panel className="p-5">
                  <h3 className="text-sm font-semibold mb-1">Sentiment by Department</h3>
                  <p className="text-xs text-muted-foreground mb-4">Where to focus next</p>
                  <div className="space-y-3">
                    {sentimentByDept.map((d) => (
                      <div key={d.dept}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-foreground">{d.dept}</span>
                          <span className="text-muted-foreground tabular-nums">{d.positive}% positive</span>
                        </div>
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full">
                          <div style={{ width: `${d.positive}%` }} className="bg-emerald-500" />
                          <div style={{ width: `${d.neutral}%` }} className="bg-muted-foreground/40" />
                          <div style={{ width: `${d.negative}%` }} className="bg-rose-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </section>
    
  );
};

export default SentimentIntelligence;
