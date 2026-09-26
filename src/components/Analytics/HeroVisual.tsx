import { BarChart3, TrendingUp, Activity, PieChart } from "lucide-react";

export function HeroVisual() {
  return (
    <div className="relative">
      {/* Layered card stack */}
      <div className="relative w-full max-w-md mx-auto">
        {/* Background card */}
        <div className="absolute -top-4 -right-4 w-full h-64 border border-border rounded-xl opacity-40 rotate-3" />
        <div className="absolute -top-2 -right-2 w-full h-64 border border-border rounded-xl opacity-60 rotate-1" />
        
        {/* Main card */}
        <div className="relative border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Hiring Pipeline</span>
            <span className="text-xs metric-chip text-green-400">
              <TrendingUp className="w-3 h-3" /> +24%
            </span>
          </div>
          
          {/* Mini chart */}
          <div className="flex items-end gap-1.5 h-20">
            {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-300"
                style={{
                  height: `${h}%`,
                  background: `linear-gradient(to top, hsl(263 70% 50% / ${0.3 + (h / 100) * 0.7}), hsl(200 80% 50% / ${0.2 + (h / 100) * 0.5}))`,
                }}
              />
            ))}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">847</div>
              <div className="text-[10px] text-muted-foreground">Applicants</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">92%</div>
              <div className="text-[10px] text-muted-foreground">Match Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-primary">12d</div>
              <div className="text-[10px] text-muted-foreground">Avg. TTH</div>
            </div>
          </div>
        </div>

        {/* Floating metric chips */}
        <div className="absolute -top-6 -left-6 metric-chip text-xs animate-fade-in">
          <BarChart3 className="w-3 h-3 text-primary" /> Pipeline Score: A+
        </div>
        <div className="absolute -bottom-4 -right-8 metric-chip text-xs animate-fade-in">
          <Activity className="w-3 h-3 text-green-400" /> 98% Uptime
        </div>
      </div>
    </div>
  );
}
