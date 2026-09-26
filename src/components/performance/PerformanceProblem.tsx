import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, EyeOff, Target } from "lucide-react";
import { SpotlightCard } from "../Analytics/SpotlightCard";


const PerformanceProblem: React.FC = () => {
  return (
    <section className="max-w-6xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Great jobs don't win great visibility does.
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Most employer hesitation comes from one question: "Will this actually pay off?"
          Performance Boost connects spend → outcomes with transparent, measurable ROI.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ProblemItem icon={EyeOff} title="Low Visibility" desc="Jobs buried in search results get fewer qualified candidates." />
        <ProblemItem icon={Clock} title="Slow Time-to-Fill" desc="Empty roles cost $500+/day in lost productivity." />
        <ProblemItem icon={Target} title="Poor Targeting" desc="Broad distribution wastes budget on irrelevant audiences." />
        <ProblemItem icon={AlertTriangle} title="No ROI Clarity" desc="Most platforms can't tie spend to actual hiring outcomes." />
      </div>
    </section>
  );
};

export default PerformanceProblem;

const ProblemItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}> = ({ icon: Icon, title, desc }) => (
  <SpotlightCard className="rounded-lg p-6 space-y-4 border border-border">
    <div className="">
      <Icon className="w-5 h-5" />
    </div>
    <h3 className="font-semibold text-foreground text-center">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed text-center">{desc}</p>
  </SpotlightCard>
);
