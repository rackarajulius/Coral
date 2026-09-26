import { categoryRatings } from '@/data/employer/reviews/reviews';
import { cn } from '@/lib/utils';
import { Star, Stars, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react'
import _CountUpLib from 'react-countup';
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

const ReputationOverview = () => {
    function Stars({ value, size = 14 }: { value: number; size?: number }) {
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors",
                i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
              )}
            />
          ))}
        </div>
      );
    };
    
    function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
      const chartData = data.map((v, i) => ({ i, v }));
      const color = positive ? "hsl(160 60% 40%)" : "hsl(0 70% 55%)";
      return (
        <ResponsiveContainer width="100%" height={32}>
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`sp-${positive}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sp-${positive})`} />
          </AreaChart>
        </ResponsiveContainer>
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
    
    function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
      return (
        <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
      );
    };

    
  return (
     <section className='mt-6'>
          <SectionHeader  title="Reputation Overview" description="Category ratings across the employee and candidate experience." />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {categoryRatings.map((c) => {
              const positive = c.change >= 0;
              return (
                <Panel key={c.label} className="p-4">
                  <p className="text-xs text-muted-foreground font-medium truncate">{c.label}</p>
                  <div className="flex items-baseline justify-between mt-2">
                  <CountUp
                   end={c.score}
                    duration={2}
                     decimals={1}
                    enableScrollSpy
                    scrollSpyOnce
                    className="text-2xl font-semibold tracking-tight tabular-nums"/>
                    <span className="text-xs text-muted-foreground">/ 5</span>
                  </div>
                  <Stars value={c.score} size={11} />
                  <div className="mt-3"><Sparkline data={c.spark} positive={positive} /></div>
                  <div className={cn("flex items-center gap-1 mt-1 text-[11px] font-medium", positive ? "text-emerald-600" : "text-rose-600")}>
                    {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {positive ? "+" : ""}{c.change.toFixed(1)} vs last quarter
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
  );
};

export default ReputationOverview;
