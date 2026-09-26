import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { reputationOverview, sentimentBreakdown } from "@/data/employer/reviews/reviews";
import { cn } from "@/lib/utils";
import { Star, Stars, TrendingUp } from "lucide-react";
import _CountUpLib from "react-countup";
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;


const Sentiment = () => {
  function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
      <div className={cn("rounded-xl border border-gray-300 bg-card", className)}>{children}</div>
    );
  };

  function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn(
            "transition-colors",
            i <= Math.round(value) ? "fill-accent text-accent" : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  );
}
  
  return (
     <Panel className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Overall rating */}
                  <div className="lg:col-span-3 flex flex-col justify-between border-r border-border pr-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Overall Rating</p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <CountUp
                             end={Number(reputationOverview.rating)}
                              duration={2}
                               decimals={1}
                               enableScrollSpy
                                  scrollSpyOnce
                                 className="text-5xl font-semibold tracking-tight text-foreground tabular-nums"/>
                        <span className="text-sm text-muted-foreground">/ 5.0</span>
                      </div>
                      <div className="mt-2"><Stars value={reputationOverview.rating} size={16} /></div>
                      <p className="text-xs text-muted-foreground mt-2">Based on {reputationOverview.totalReviews.toLocaleString()} reviews</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 mt-4">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {reputationOverview.trend}
                    </div>
                  </div>
    
                  {/* Health score */}
                  <div className="lg:col-span-3 flex flex-col justify-between border-r border-border pr-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Reputation Health</p>
                      <div className="flex items-baseline gap-2 mt-2">
                       <CountUp
                        enableScrollSpy
                        scrollSpyOnce
                       end={Number(reputationOverview.healthScore)}
                       duration={2}
                       className="text-5xl font-semibold tracking-tight text-foreground tabular-nums"/>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                      </div>
                      <Badge variant="outline" className="mt-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                        {reputationOverview.healthStatus}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <Progress value={reputationOverview.healthScore} className="h-1.5" />
                    </div>
                  </div>
    
                  {/* Sentiment hero */}
                  <div className="lg:col-span-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Sentiment Mix</p>
                      <span className="text-xs text-muted-foreground">Last 90 days</span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full">
                      <div style={{ width: `${sentimentBreakdown.positive}%` }} className="bg-emerald-500" />
                      <div style={{ width: `${sentimentBreakdown.neutral}%` }} className="bg-muted-foreground/40" />
                      <div style={{ width: `${sentimentBreakdown.negative}%` }} className="bg-rose-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {[
                        { label: "Positive", value: sentimentBreakdown.positive, color: "bg-emerald-500" },
                        { label: "Neutral", value: sentimentBreakdown.neutral, color: "bg-muted-foreground/40" },
                        { label: "Negative", value: sentimentBreakdown.negative, color: "bg-rose-500" },
                      ].map((s) => (
                        <div key={s.label}>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", s.color)} />
                            <span className="text-xs text-muted-foreground">{s.label}</span>
                          </div>
                          <CountUp
                                end={s.value}
                                enableScrollSpy
                                scrollSpyOnce
                                duration={2}
                                suffix="%"
                               decimals={Number(s.value) % 1 !== 0 ? 1 : 0}
                              className="text-xl font-semibold tracking-tight text-foreground mt-1 tabular-nums"/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
  );
};
export default Sentiment;
