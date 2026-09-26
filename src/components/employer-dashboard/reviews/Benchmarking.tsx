
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid,
} from "recharts";
import { cn } from '@/lib/utils';
import React from 'react'
import { benchmarks } from "@/data/employer/reviews/reviews";

const Benchmarking = () => {
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

    function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
            return (
              <div className={cn("rounded-xl border border-gray-300 bg-card", className)}>{children}</div>
            );
          };
  return (
     <section className="mt-6">
              <SectionHeader title="Benchmarking" description="How you compare to industry peers and top employers." />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Competitive Radar</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={benchmarks}>
                      <PolarGrid stroke="#e5e7eb" />

<PolarAngleAxis
  dataKey="metric"
  tick={{ fontSize: 11, fill: "#64748b" }}
/>

<PolarRadiusAxis
  angle={90}
  domain={[0, 5]}
  tick={{ fontSize: 10 }}
/>

<Radar
  name="You"
  dataKey="you"
  stroke="#f97316"
  fill="#f97316"
  fillOpacity={0.35}
/>

<Radar
  name="Industry"
  dataKey="industry"
  stroke="#94a3b8"
  fill="#94a3b8"
  fillOpacity={0.15}
/>

<Radar
  name="Top"
  dataKey="top"
  stroke="#10b981"
  fill="#10b981"
  fillOpacity={0.1}
/>

<RTooltip
  contentStyle={{
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 12,
  }}
/>
                    </RadarChart>
                  </ResponsiveContainer>
                </Panel>
    
                <Panel className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Benchmark Comparison</h3>
                  <div className="space-y-4">
                    {benchmarks.map((b) => (
                      <div key={b.metric}>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-medium">{b.metric}</span>
                          <div className="flex items-center gap-3 tabular-nums">
                            <span className="text-accent font-semibold">You {b.you}</span>
                            <span className="text-muted-foreground">Ind {b.industry}</span>
                            <span className="text-emerald-600">Top {b.top}</span>
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full bg-slate-200">
  <div
    className="absolute h-full rounded-full bg-slate-400"
    style={{ width: `${(b.industry / 5) * 100}%` }}
  />
  <div
    className="absolute h-full rounded-full bg-orange-400"
    style={{ width: `${(b.you / 5) * 100}%` }}
  />
  <div
    className="absolute -top-0.5 h-3 w-0.5 bg-emerald-400"
    style={{ left: `${(b.top / 5) * 100}%` }}
  />
</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </section>
    
  );
};

export default Benchmarking;
