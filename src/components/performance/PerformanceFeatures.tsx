import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  BadgeCheck,
  BarChart3,
  CandlestickChart,
  Globe,
  Megaphone,
  Rocket,
  Sparkles,
} from "lucide-react";
import { SpotlightCard } from "../Analytics/SpotlightCard";


const features = [
  {
    icon: Megaphone,
    title: "Sponsored Job Listings",
    improves: "Visibility and top-of-feed reach",
    impact: "More qualified traffic → lower cost per applicant",
  },
  {
    icon: Rocket,
    title: "Priority Search Ranking",
    improves: "Impressions in high-intent search",
    impact: "Higher CTR → more applications per dollar",
  },
  {
    icon: BadgeCheck,
    title: "Featured Employer Badges",
    improves: "Trust and click-through",
    impact: "More conversion from views → clicks → applies",
  },
  {
    icon: Globe,
    title: "Smart Job Distribution",
    improves: "Reach across relevant audiences",
    impact: "Expanded pipeline without wasted spend",
  },
  {
    icon: CandlestickChart,
    title: "Application Conversion Optimization",
    improves: "Apply rate and funnel efficiency",
    impact: "More applications without increasing budget",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics Dashboard",
    improves: "Spend → outcomes clarity",
    impact: "Confidence to scale what works",
  },
];

const PerformanceFeatures: React.FC = () => {
  return (
    <section className="max-w-6xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <Badge variant="default" className="gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Performance Tools & Features
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Feature-level ROI—<span className="text-primary">built into every boost.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Each tool improves a measurable part of the hiring funnel and connects performance to spend.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <SpotlightCard key={f.title} className="glass-card border border-border p-6 space-y-4">
            <div className="icon-squircle w-fit">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{f.title}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">What it improves</p>
                <p className="text-sm text-foreground/80">{f.improves}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">How it impacts ROI</p>
                <p className="text-sm text-foreground/80">{f.impact}</p>
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
};

export default PerformanceFeatures;
