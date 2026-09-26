import React, { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PerformanceHero from "@/components/performance/PerformanceHero";
import PerformanceProblem from "@/components/performance/PerformanceProblem";
import BoostHowItWorks from "@/components/performance/BoostHowItWorks";
import PerformanceFeatures from "@/components/performance/PerformanceFeatures";
import FinalCTA from "@/components/performance/FinalCTA";
import BudgetControl from "@/components/performance/BudgetControl";
import ROIMetrics from "@/components/performance/ROIMetrics";
import Navbar from "@/components/navbar/Navbar";
import ScrollToTop from "@/components/ui/ScrollToTop";
import Footer from "@/components/landing/Footer";

gsap.registerPlugin(ScrollTrigger);

export default function PerformanceBoost() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Scroll progress bar
      ScrollTrigger.create({
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const bar = document.querySelector(".boost-scroll-progress") as HTMLElement;
          if (bar) bar.style.height = `${self.progress * 100}%`;
        },
      });

      // Animate sections on scroll
      gsap.utils.toArray<HTMLElement>(".boost-section").forEach((section) => {
        gsap.from(section, {
          opacity: 0,
          y: 60,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid bg-radial-glow relative pt-10">
     <Navbar/>

      <div className="space-y-24 md:space-y-32 lg:space-y-40">
        <PerformanceHero />
        <div className="boost-section"><PerformanceProblem /></div>
        <div className="boost-section"><BoostHowItWorks /></div>
        <div className="boost-section"><PerformanceFeatures /></div>
        <div className="boost-section"><ROIMetrics /></div>
        <div className="boost-section"><BudgetControl /></div>
        <div className="boost-section"><FinalCTA /></div>
      </div>
        <ScrollToTop />

      {/* Footer */}
      <Footer/>
    </div>
  );
}
