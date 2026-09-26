import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { responseTemplates, reviews } from '@/data/employer/reviews/reviews';
import { cn } from '@/libs/utils';
import { Star, Stars } from 'lucide-react';
import React from 'react'

const ResponseCenter = () => {
  
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
  }
  
  function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
      <div className={cn("rounded-xl border border-gray-300 bg-card", className)}>{children}</div>
    );
  }
  return (
     <section className='mt-6'>
          <SectionHeader title="Response Center" description="Manage outstanding responses and templates." />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel className="p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-4">Reviews Requiring Response</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                  <div className="col-span-5">Review</div>
                  <div className="col-span-1">Rating</div>
                  <div className="col-span-2">Priority</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Assignee</div>
                </div>
                {reviews.filter((r) => !r.responded).map((r) => (
                  <div key={r.id} className="grid grid-cols-12 gap-3 items-center px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors text-sm">
                    <div className="col-span-5 min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.type} · {r.department}</p>
                    </div>
                    <div className="col-span-1"><Stars value={r.rating} size={11} /></div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        r.rating <= 2 ? "bg-rose-500/10 border-rose-500/30 text-rose-700" :
                        r.rating <= 3 ? "bg-amber-500/10 border-amber-500/30 text-amber-700" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {r.rating <= 2 ? "High" : r.rating <= 3 ? "Medium" : "Low"}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">{r.date}</div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel className="p-5">
                <h3 className="text-sm font-semibold mb-3">Response Performance</h3>
                <div className="space-y-3">
                  {[
                    { label: "Response Rate", value: "87%", color: "text-emerald-600" },
                    { label: "Avg Response Time", value: "6.4h", color: "text-foreground" },
                    { label: "Responded This Month", value: "142", color: "text-foreground" },
                    { label: "Unanswered Reviews", value: "21", color: "text-amber-600" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{m.label}</span>
                      <span className={cn("text-sm font-semibold tabular-nums", m.color)}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5">
                <h3 className="text-sm font-semibold mb-3">Response Templates</h3>
                <div className="space-y-1.5">
                  {responseTemplates.map((t) => (
                    <button key={t.id} className="w-full text-left p-2.5 rounded-md hover:bg-muted/50 transition-colors group">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.body}</p>
                    </button>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-2">+ New Template</Button>
                </div>
              </Panel>
            </div>
          </div>
        </section>
    
  );
};

export default ResponseCenter;
