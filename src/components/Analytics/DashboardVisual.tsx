import { TrendingUp, Users, Target, Clock, CheckCircle, BarChart3, PieChart, Activity, LineChart, UsersRound } from "lucide-react";

export function DashboardVisual() {
  return (
    <div className=" border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Candidate Ranking</h4>
        <span className="text-xs text-muted-foreground">Updated 2m ago</span>
      </div>

      {/* Candidate rows */}
      {[
        { name: "Sarah Chen", role: "Sr. Engineer", score: 96, color: "hsl(263 70% 50%)" },
        { name: "Marcus Johnson", role: "Lead Designer", score: 91, color: "hsl(200 80% 50%)" },
        { name: "Priya Patel", role: "PM", score: 87, color: "hsl(150 60% 45%)" },
        { name: "Alex Rivera", role: "Data Analyst", score: 82, color: "hsl(40 80% 55%)" },
      ].map((candidate, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${candidate.color}20`, color: candidate.color }}>
            {candidate.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground truncate">{candidate.name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${candidate.color}15`, color: candidate.color }}>{candidate.score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${candidate.score}%`, background: candidate.color }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{candidate.role}</span>
          </div>
        </div>
      ))}

      {/* KPI chips */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="metric-chip text-xs">
          <Clock className="w-3 h-3 text-primary" />
          <span>TTH: <span className="text-green-400 font-semibold">-12%</span></span>
        </div>
        <div className="metric-chip text-xs">
          <Target className="w-3 h-3 text-primary" />
          <span>Quality: <span className="text-green-400 font-semibold">+8%</span></span>
        </div>
        <div className="metric-chip text-xs">
          <UsersRound className="w-3 h-3 text-primary" />
          <span>Volume: <span className="text-foreground font-semibold">2.4k</span></span>
        </div>
        <div className="metric-chip text-xs">
          <TrendingUp className="w-3 h-3 text-primary" />
          <span>ROI: <span className="text-green-400 font-semibold">340%</span></span>
        </div>
      </div>
    </div>
  );
}
