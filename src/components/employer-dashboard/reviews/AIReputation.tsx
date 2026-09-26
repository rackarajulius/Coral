import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { aiSummary, emergingThemes, recommendations, riskAlerts } from '@/data/employer/reviews/reviews';
import { cn } from '@/libs/utils';
import { AlertTriangle, ChevronDown, Sparkles } from 'lucide-react';
import React from 'react'

const AIReputation = () => {
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
          <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
        );
      }
  return (
   <section className='mt-6'>
          <SectionHeader title="AI Reputation Intelligence" description="Executive summary, emerging themes, risks, and recommended actions." />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel className="p-6 lg:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-32 w-32 bg-accent/5 blur-3xl rounded-full" />
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold">Executive Summary</h3>
                <Badge variant="outline" className="text-[10px]">AI Generated</Badge>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{aiSummary}</p>

              <Separator className="my-5" />

              <h4 className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-3">Emerging Themes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {emergingThemes.map((t) => (
                  <div key={t.label} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm text-foreground">{t.label}</span>
                    <span className={cn("text-xs font-semibold tabular-nums", t.tone === "positive" ? "text-emerald-600" : "text-rose-600")}>
                      {t.trend > 0 ? "+" : ""}{t.trend}%
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold">Risk Alerts</h3>
              </div>
              <div className="space-y-2">
                {riskAlerts.map((a, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg border text-sm",
                    a.level === "high" ? "bg-rose-500/5 border-rose-500/30 text-rose-900" : "bg-amber-500/5 border-amber-500/30 text-amber-900"
                  )}>
                    {a.text}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5 lg:col-span-3">
              <h3 className="text-sm font-semibold mb-4">Recommended Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 hover:border-foreground/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        rec.priority === "High" ? "bg-rose-500/10 border-rose-500/30 text-rose-700" : "bg-amber-500/10 border-amber-500/30 text-amber-700"
                      )}>{rec.priority}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">Impact {rec.impact}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{rec.action}</p>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{rec.owner}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">Assign <ChevronDown className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
  );
};

export default AIReputation;
