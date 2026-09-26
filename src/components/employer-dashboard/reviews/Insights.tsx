import { improvements, strengths, topicInsights } from "@/data/employer/reviews/reviews";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp } from "lucide-react";


const TopicInsights = () => {

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
              <SectionHeader title="Topic & Category Insights" description="AI-extracted themes from review text." />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Panel className="p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold mb-4">Most Discussed Topics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {topicInsights.map((t) => {
                      const positive = t.trend >= 0;
                      return (
                        <div key={t.topic} className="rounded-lg border border-gray-300 p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{t.topic}</span>
                            <span className={cn("text-xs font-medium tabular-nums", positive ? "text-emerald-600" : "text-rose-600")}>
                              {positive ? "+" : ""}{t.trend}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{t.mentions} mentions</span>
                          </div>
                          <div className="mt-2 flex h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div style={{ width: `${t.positive}%` }} className="bg-emerald-500" />
                            <div style={{ width: `${t.negative}%` }} className="bg-rose-500" />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                            <span>{t.positive}% positive</span>
                            <span>{t.negative}% negative</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
    
                <div className="space-y-4">
                  <Panel className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <h3 className="text-sm font-semibold">Strengths</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {strengths.map((s) => (
                        <li key={s} className="text-sm text-foreground flex gap-2">
                          <span className="text-emerald-500 mt-1.5 h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
    
                  <Panel className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <h3 className="text-sm font-semibold">Areas to Improve</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {improvements.map((s) => (
                        <li key={s} className="text-sm text-foreground flex gap-2">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>
              </div>
            </section>
    
  )
};

export default TopicInsights;
