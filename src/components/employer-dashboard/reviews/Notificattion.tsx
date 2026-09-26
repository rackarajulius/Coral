import { Button } from '@/components/ui/button';
import { notifications } from '@/data/employer/reviews/reviews';
import { cn } from '@/lib/utils';
import { Bell, Settings } from 'lucide-react';
import React from 'react'

const Notificattion = () => {
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
    <section className='mt-6'>
              <SectionHeader title="Alerts & Notifications" description="Reputation events worth your attention." action={
                <Button variant="ghost" size="sm" className="gap-2"><Settings className="h-3.5 w-3.5" />Preferences</Button>
              }/>
              <Panel className="divide-y divide-border">
                {notifications.map((n) => (
                  <div key={n.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      n.level === "high" ? "bg-rose-500/10 text-rose-600" :
                      n.level === "medium" ? "bg-amber-500/10 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{n.time} ago</span>
                  </div>
                ))}
              </Panel>
            </section>
    
  );
};

export default Notificattion;
