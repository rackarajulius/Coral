import React from "react";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, BarChart3, Layers, Radar, Sparkles } from "lucide-react";
import { SpotlightCard } from "../Analytics/SpotlightCard";


const BoostHowItWorks: React.FC = () => {
  const steps = [
    { icon: Layers, title: "1. Smart Placement", body: "Your job is positioned in high-intent search results and recommended feeds.", outcome: "3x more qualified impressions" },
    { icon: Radar, title: "2. Relevance Matching", body: "AI matches your listing to candidates with the right skills and experience.", outcome: "65% higher apply rate" },
    { icon: BarChart3, title: "3. Performance Optimization", body: "Real-time bidding adjusts placement based on conversion signals.", outcome: "28% lower cost per applicant" },
    { icon: Sparkles, title: "4. Measurable Results", body: "Full-funnel attribution from impression to hire with ROI tracking.", outcome: "Clear spend → hire reporting" },
  ];

  return (
    <section className="max-w-6xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <Badge variant="default" className="gap-2">
          <Layers className="w-3.5 h-3.5" />
          How Performance Boost Works
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          A clear system: <span className="text-primary">placement → results.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Each boost package increases hiring performance using paid visibility, skill-relevant exposure,
          and feedback loops that continuously improve conversion.
        </p>
      </div>

      {/* Connective line */}
      <div className="relative">
        <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r
         from-transparent via-primary/20 to-transparent -translate-y-1/2 z-0" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {steps.map((s) => (
            <HowCard key={s.title} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BoostHowItWorks;

const HowCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  outcome: string;
}> = ({ icon: Icon, title, body, outcome }) => (
  <SpotlightCard className="glass-card p-6 space-y-4 border border-border">
    <div className="icon-squircle w-fit">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <h3 className="font-semibold text-foreground text-center">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed text-center">{body}</p>
    <div className="bg-orange-500 !rounded-lg px-3 py-2 flex items-center gap-2 border border-border">
      <BadgeCheck className="w-4 h-4 text-muted shrink-0" />
      <span className="text-xs text-muted font-medium">{outcome}</span>
    </div>
  </SpotlightCard>
);
