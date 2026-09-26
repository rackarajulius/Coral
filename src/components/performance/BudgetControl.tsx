import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DollarSign, PauseCircle, ShieldCheck, SlidersHorizontal } from "lucide-react";

const BudgetControl: React.FC = () => {
  const navigate = useNavigate();
  const [daily, setDaily] = useState(25);
  const [days, setDays] = useState(14);

  const total = useMemo(() => daily * days, [daily, days]);
  const projectedHires = useMemo(() => Math.max(1, Math.round((total / 142) * 10) / 10), [total]);

  return (
    <section className="max-w-6xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <Badge variant="default" className="gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Budget Control & Transparency
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Control spend. <span className="text-primary">Measure impact.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          No long-term commitments. Pause or change budgets based on real performance—pay for outcomes, not promises.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <Card className="glass-card border border-border p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Daily budget</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">${daily}</span>
                <span className="text-xs text-muted-foreground ml-1">per day</span>
              </div>
            </div>
            <Slider
              min={5}
              max={200}
              step={5}
              value={[daily]}
              onValueChange={(v) => setDaily(v[0] ?? 25)}
              aria-label="Daily budget"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Boost duration</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">{days} days</span>
                <span className="text-xs text-muted-foreground ml-1">campaign length</span>
              </div>
            </div>
            <Slider
              min={3}
              max={90}
              step={1}
              value={[days]}
              onValueChange={(v) => setDays(v[0] ?? 14)}
              aria-label="Boost duration"
            />
          </div>
        </Card>

        {/* Summary */}
        <Card className="glass-card border border-border p-6 space-y-6">
          <div className="glass-card border border-border !rounded-lg p-5 text-center space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated total budget</p>
            <p className="text-4xl font-bold text-foreground">${total}</p>
            <p className="text-xs text-muted-foreground">≈ {projectedHires} projected hires</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <PauseCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Pause anytime</p>
                <p className="text-xs text-muted-foreground">Stop spend instantly if ROI dips.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Transparent reporting</p>
                <p className="text-xs text-muted-foreground">Track views → hires with attribution.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" variant="default" className="flex-1 rounded-full">
              Apply Budget
            </Button>
            <Button size="lg" variant="outline" className="flex-1 rounded-full" onClick={() => navigate("/employers/pricing")}>
              View Packages
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Budgets shown are for UI demonstration only.
          </p>
        </Card>
      </div>
    </section>
  );
};

export default BudgetControl;
