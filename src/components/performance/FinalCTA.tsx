import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp } from "lucide-react";

const FinalCTA: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="max-w-4xl mx-auto px-6">
      <div className="p-10 md:p-16 text-center space-y-8 glow-pulse relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <Badge variant="default" className="gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Strong Commercial CTA
          </Badge>

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Turn Job Spend Into <span className="text-primary">Hiring Results</span>
          </h2>

          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Upgrade with confidence. Performance Boost is designed for measurable ROI, not just more views.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Button variant="default" size="lg" className="rounded-full" onClick={() => navigate("/employers/jobs")}>
              Boost a Job Now <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" className="rounded-full" onClick={() => navigate("/employers/pricing")}>
              View Performance Packages
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            No long-term contracts. Pause anytime.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
