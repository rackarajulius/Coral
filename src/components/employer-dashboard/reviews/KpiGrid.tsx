import { kpiCards } from '@/data/employer/reviews/reviews';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import React from 'react'
import _CountUpLib from 'react-countup';
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;

const KpiGrid = () => {
    function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
      return (
        <div className={cn("rounded-xl border border-gray-300 bg-card", className)}>{children}</div>
      );
    };
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-4 gap-3">
                {kpiCards.map((k) => {
                  const positive = k.change >= 0;
                  const isInverse = k.id === "rtime";
                  const good = isInverse ? !positive : positive;
                  return (
                    <Panel key={k.id} className="p-4 hover:shadow-card transition-shadow">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{k.label}</p>
                       <CountUp
                          end={Number(k.value.replace(/,/g, "").replace(/[^\d.-]/g, ""))}
                           duration={2}
                           separator=","
                           decimals={k.value.includes(".") ? 1 : 0}
                           suffix="%"
                           enableScrollSpy
                           scrollSpyOnce
                          className="text-2xl font-semibold tracking-tight text-foreground mt-2 tabular-nums"/>
                      <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", good ? "text-emerald-600" : "text-rose-600")}>
                        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(k.change)}%
                        <span className="text-muted-foreground font-normal ml-1 truncate">vs prev</span>
                      </div>
                    </Panel>
                  );
                })}
    </div>
    
  );
};

export default KpiGrid;
