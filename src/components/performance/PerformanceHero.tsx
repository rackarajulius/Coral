import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, BarChart3, Sparkles, TrendingUp, Zap, Users, Target } from "lucide-react";
import { gsap } from "gsap";

const PerformanceHero: React.FC = () => {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Character-by-character title animation
      if (titleRef.current) {
        const chars = titleRef.current.querySelectorAll(".hero-char");
        gsap.from(chars, {
          opacity: 0,
          y: 50,
          rotationX: -90,
          stagger: 0.02,
          duration: 0.7,
          ease: "back.out(1.7)",
          delay: 0.3,
        });
      }

      gsap.from(".perf-hero-badge", {
        opacity: 0,
        scale: 0.5,
        duration: 0.8,
        ease: "elastic.out(1, 0.5)",
        delay: 0.1,
      });

      gsap.from(".perf-hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.8,
      });

      gsap.from(".perf-hero-cta", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 1,
      });

      gsap.from(".perf-hero-visual", {
        opacity: 0,
        x: 80,
        scale: 0.9,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.5,
      });

      gsap.from(".perf-kpi", {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.5,
        delay: 1.2,
      });
    });

    return () => ctx.revert();
  }, []);

 
  return (
  
  <section className="relative overflow-hidden pt-10 pb-16">
    
    <div className="relative z-10 container mx-auto px-4 md:px-12 lg:px-24 py-8 md:py-12 lg:py-16">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

        {/* ================= LEFT CONTENT ================= */}
        <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left space-y-4">

          {/* Heading */}
          <h1
            ref={titleRef}
            className="text-3xl xsm:text-4xl xs:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight mb-4"
          >
            Boost Job Performance,
            <br className="hidden sm:block" />
            Hire Faster,
            <br className="hidden sm:block" />
            Maximize ROI.
          </h1>

          {/* Subtitle */}
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0 mb-6 md:mb-8">
            Promote your jobs to the right candidates and get measurable results —
            more visibility, higher-quality applications, and faster hires.
          </p>

          {/* CTA */}
          <div className="perf-hero-cta flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            
            <Button
              className="group w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base rounded-full"
              size="lg"
              onClick={() => navigate("/employer/jobs")}
            >
              Boost My Job
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base rounded-full"
              variant="outline"
              size="lg"
              onClick={() =>
                document.getElementById("roi")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              See ROI Breakdown
            </Button>
          </div>

          {/* KPI GRID */}
          <div className="perf-kpi grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 pt-4">
            <Kpi icon={Zap} value="3x" label="More Views" />
            <Kpi icon={TrendingUp} value="-40%" label="Time to Hire" />
            <Kpi icon={Users} value="+65%" label="Applications" />
            <Kpi icon={Target} value="2.4x" label="ROI" />
          </div>

        </div>

        {/* ================= RIGHT VISUAL ================= */}
        <div className="perf-hero-visual relative hidden sm:block">

          <div className="relative max-w-md mx-auto lg:max-w-none">

            {/* Background layers */}
            <div className="absolute -top-4 -right-4 w-full h-64 md:h-72 opacity-30 rotate-2 rounded-xl border border-border" />
            <div className="absolute -top-2 -right-2 w-full h-64 md:h-72 opacity-50 rotate-1 rounded-xl border border-border" />

            {/* Card */}
            <Card className="relative rounded-xl p-4 md:p-6 space-y-5 border border-border">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="icon-squircle !p-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">
                    Visibility & ROI
                  </span>
                </div>

                <Badge className="text-xs gap-1">
                  <TrendingUp className="w-3 h-3" /> +27% ROI
                </Badge>
              </div>

              {/* Chart */}
              <div className="flex items-end gap-1.5 h-20 md:h-24">
                {[35, 55, 40, 70, 50, 85, 60, 90, 55, 80, 65, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: `linear-gradient(to top, hsl(263 70% 50% / ${
                        0.3 + (h / 100) * 0.7
                      }), hsl(200 80% 50% / ${
                        0.2 + (h / 100) * 0.5
                      }))`,
                    }}
                  />
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <MiniStat title="Impressions" value="12.4k" hint="+34%" />
                <MiniStat title="Apply Rate" value="8.2%" hint="Above avg" />
                <MiniStat title="Cost/Hire" value="$142" hint="-28%" />
              </div>

            </Card>

          </div>
        </div>

      </div>
    </div>
  </section>

  );
};

export default PerformanceHero;

const Kpi: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }> }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="metric-chip flex-col !items-start !gap-1 border border-border">
    <div className="flex items-center gap-2">
      <div className="icon-squircle !p-1.5 !rounded-lg border border-border">
        <Icon className="w-3 h-3 text-primary" />
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

const MiniStat: React.FC<{ title: string; value: string; hint: string }> = ({ title, value, hint }) => (
  <div className="text-center space-y-1">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[10px] text-muted-foreground">{hint}</p>
  </div>
);
