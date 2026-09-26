import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart3, DollarSign, TrendingUp, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const data = [
  { week: "W1", views: 1200, applies: 32, hires: 2 },
  { week: "W2", views: 2100, applies: 54, hires: 4 },
  { week: "W3", views: 3400, applies: 78, hires: 6 },
  { week: "W4", views: 4100, applies: 96, hires: 8 },
];

const chartConfig: ChartConfig = {
  views: { label: "Views", color: "hsl(var(--primary))" },
  applies: { label: "Applications", color: "hsl(142.1 76.2% 36.3%)" },
  hires: { label: "Hires", color: "hsl(38 92% 50%)" },
};

const ROIMetrics: React.FC = () => {
  return (
    <section id="roi" className="max-w-6xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <Badge variant="default" className="gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          ROI & Impact Metrics
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Clear outcomes, <span className="text-primary">not vanity metrics.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Track the full funnel—from impressions to hires—so you can confidently scale spend based on impact.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={TrendingUp} label="Avg. Visibility Lift" value="+312%" sub="vs. organic listings" />
        <MetricCard icon={Users} label="Application Increase" value="+65%" sub="qualified candidates" />
        <MetricCard icon={DollarSign} label="Cost per Hire" value="$142" sub="-28% vs. industry avg" />
        <MetricCard icon={Zap} label="Time to Fill" value="12 days" sub="-40% faster" />
      </div>

      {/* Chart */}
      <Card className="glass-card border border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Boost Results</h3>
            <p className="text-xs text-muted-foreground">Views, applications, and hires over time</p>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="appliesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#viewsGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="applies" stroke="hsl(142.1 76.2% 36.3%)" fill="url(#appliesGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="hires" stroke="hsl(38 92% 50%)" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
          </AreaChart>
        </ChartContainer>

        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          <div className="glass-card border border-border  !rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground text-center">Interpretation</p>
            <p className="text-sm text-foreground/80 text-center mt-1">More visibility increases qualified traffic, raising applications and hire velocity.</p>
          </div>
          <div className="glass-card border border-border  !rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground text-center">Spend → Outcomes</p>
            <p className="text-sm text-foreground/80 text-center mt-1">Increase budget only when cost-per-hire improves.</p>
          </div>
          <div className="glass-card border border-border !rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground text-center">Attribution</p>
            <p className="text-sm text-foreground/80 text-center mt-1">Full-funnel tracking from impression to signed offer.</p>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default ROIMetrics;

const MetricCard: React.FC<{
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, sub, icon: Icon }) => (
  <Card className="glass-card border border-border p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="icon-squircle !p-2">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </div>
  </Card>
);
