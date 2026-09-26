import { roiMetrics } from '@/data/employer/pricing/pricing'
import React, { useEffect, useState } from 'react'

const useCountUp = (target: number, duration = 1200) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let raf = 0;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const RoiMetricCard = ({ value, suffix, label, sub }: typeof roiMetrics[number]) => {
     const animated = useCountUp(value);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="flex items-baseline gap-1">
        <span className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-foreground">
          {animated}
        </span>
        <span className="text-3xl font-semibold text-foreground">{suffix}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{sub}</p>
    </div>
  )
}

export default RoiMetricCard
