import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle, BarChart3, TrendingUp, Clock, Search, LineChart, PieChart, Activity, Users, Target, UsersRound } from "lucide-react";

import { HeroVisual } from "@/components/Analytics/HeroVisual";
import { DashboardVisual } from "@/components/Analytics/DashboardVisual";
import { SpotlightCard } from "@/components/Analytics/SpotlightCard";
import Navbar from "@/components/navbar/Navbar";
import ScrollToTop from "@/components/ui/ScrollToTop";
import Footer from "@/components/landing/Footer";

function SplitTitle({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span key={i} className="hero-char inline-block" style={{ display: char === " " ? "inline" : undefined }}>
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </>
  );
}

const features = [
  { icon: Activity, title: "Real-Time Pipeline Tracking", desc: "Monitor candidate pipelines in real time with live updates and progress indicators." },
  { icon: Search, title: "Sourcing Channel Analysis", desc: "Identify top-performing sourcing channels and optimize your recruitment strategy." },
  { icon: Clock, title: "Hiring Timeline Prediction", desc: "Predict hiring timelines and reduce time-to-fill with data-driven forecasting." },
  { icon: TrendingUp, title: "Industry Benchmarking", desc: "Benchmark against industry trends and stay ahead of the competition." },
];

const dashboardItems = [
  { icon: LineChart, label: "Performance Metrics" },
  { icon: PieChart, label: "Candidate Demographics" },
  { icon: UsersRound, label: "Team Collaboration" },
  { icon: Target, label: "Success Metrics" },
];

const benefits = [
  { title: "Data-Driven Decisions", desc: "Make informed hiring decisions backed by comprehensive analytics." },
  { title: "Competitive Advantage", desc: "Stay ahead with industry benchmarking and trend analysis." },
  { title: "ROI Optimization", desc: "Maximize your recruitment ROI with predictive insights." },
];

export default function AdvancedAnalytics() {


  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-x-hidden">

      <Navbar/>
     
      {/* Radial glow backdrop */}
      <div className="fixed inset-0 bg-radial-glow pointer-events-none" />

      {/* Hero Section */}
<section className="relative pt-10 pb-16 overflow-hidden">

  <div className="container mx-auto px-4 md:px-12 lg:px-24 py-8 md:py-12 lg:py-16">

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

      {/* ================= LEFT CONTENT ================= */}
      <div className="space-y-6 md:space-y-8 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
          Unlock Smarter Hiring Decisions
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
          Turn recruitment data into actionable insights. Track pipelines,
          identify top channels, predict timelines, and benchmark against
          industry trends.
        </p>

        {/* CTA */}
        <div className="hero-cta flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">

          <Button
            className="group w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-semibold rounded-full"
            size="lg"
          >
            Start Analytics Today
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>

          <Button
            variant="outline"
            className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-semibold rounded-full"
            size="lg"
          >
            View Demo Dashboard
          </Button>

        </div>

      </div>

      {/* ================= RIGHT VISUAL ================= */}
      <div className="hero-visual relative hidden sm:block lg:pl-8">

        <div className="relative max-w-md mx-auto lg:max-w-none">

          {/* Main Visual */}
          <div className="relative">
            <HeroVisual />
          </div>

        </div>

      </div>

    </div>
  </div>
</section>

      {/* Features Section */}
      <section className="features-section py-20 relative">
        <div className="container mx-auto px-4 md:px-12 lg:px-24">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Analytics That Drive Results
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Empower your HR team with clear, data-driven dashboards that simplify decision-making and maximize ROI.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <SpotlightCard key={i} className="feature-card space-y-4">
                <div className="icon-squircle w-12 h-12">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Section - Bento */}
      <section className="dashboard-section py-20 relative">
        <div className="container mx-auto px-4 md:px-12 lg:px-24">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Interactive Dashboards
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Clean, modern analytics dashboards showing charts, graphs, and KPIs for comprehensive insights.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-4">
              {dashboardItems.map((item, i) => (
                <div key={i} className="dashboard-list-item glass-card-hover p-5 flex items-center gap-4">
                  <div className={i % 2 === 0 ? "icon-squircle w-10 h-10" : "icon-squircle-accent w-10 h-10"}>
                    <item.icon className={`w-4 h-4 ${i % 2 === 0 ? "text-primary" : "text-glow-accent"}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="dashboard-visual">
              <DashboardVisual />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section py-20 relative">
        <div className="container mx-auto px-4 md:px-12 lg:px-24">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Why Choose Advanced Analytics?
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Transform your hiring strategy with data-driven insights that deliver measurable results.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {benefits.map((b, i) => (
                <div key={i} className="benefit-item flex items-start gap-4 p-4 rounded-xl transition-colors hover:bg-secondary/30">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-base font-semibold text-foreground mb-1">{b.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-border rounded-lg p-8 text-center space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold text-primary">340%</div>
                  <div className="text-xs text-muted-foreground mt-1">Average ROI</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">-42%</div>
                  <div className="text-xs text-muted-foreground mt-1">Time to Hire</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">92%</div>
                  <div className="text-xs text-muted-foreground mt-1">Match Accuracy</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">2.4k</div>
                  <div className="text-xs text-muted-foreground mt-1">Active Users</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section py-20 relative">
        <div className="container mx-auto px-4 md:px-12 lg:px-24">
          <div className="cta-section-inner  text-center p-12 sm:p-16 max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Transform your hiring strategy <span className="text-gradient-primary">today</span>
            </h2>
            <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
              Discover the power of Advanced Analytics and unlock smarter hiring decisions.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <Button variant="default" size="lg" className="text-sm font-semibold rounded-full">
                Get Started with Analytics
              </Button>
              <Button variant="outline" size="lg" className="text-sm font-semibold rounded-full">
                Schedule a Demo
              </Button>
            </div>
          </div>
        </div>
      </section>
      
        <ScrollToTop />

      {/* Footer */}

      <Footer/>
    </div>
  );
}
