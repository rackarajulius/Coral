import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroBg from "@/assets/dashboard-hero.jpg";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

interface HeroBannerProps {
  companyName: string;
  userName: string;
  summary: string;
  bannerUrl?: string | null;
  tagline?: string | null;
}

const HeroBanner = ({ companyName, userName, summary, bannerUrl, tagline }: HeroBannerProps) => (
  <section
    className="relative overflow-hidden rounded-3xl border border-border"
    aria-label="Welcome banner"
  >
    <img
      src={bannerUrl || heroBg}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-[hsl(239_84%_15%/0.95)] via-[hsl(239_84%_22%/0.85)] to-[hsl(239_84%_30%/0.55)]" />
    <div className="relative p-6 sm:p-8 lg:p-12">
      <p className="text-sm font-medium text-white/50 mb-2 tracking-wide">
        {getGreeting()}, {userName}
      </p>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-3xl">
        {companyName}
      </h1>
      {tagline && (
        <p className="mt-2 text-sm md:text-base text-white/80 max-w-2xl">{tagline}</p>
      )}
      <p className="mt-3 text-base md:text-lg text-white/70 max-w-2xl">
        Track performance, take quick actions, and upgrade when you want faster reach.
      </p>
      <p className="mt-2 text-sm text-white/40">{summary}</p>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Button size="sm" className="rounded-full bg-white text-gray-900 hover:bg-white/90 shadow-lg" asChild>
          <Link to="/employers/jobs">Manage jobs <ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <Button size="sm" className="rounded-full bg-white/10 text-white border border-white/20 backdrop-blur-md hover:bg-white/20" asChild>
          <Link to="/employers/candidates">Review applicants</Link>
        </Button>
        <Button size="sm" variant="outline" className="rounded-full bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white" asChild>
          <Link to="/employers/hiring"><Sparkles className="h-4 w-4" /> Try Talent Scout</Link>
        </Button>
        <Button size="sm" variant="outline" className="rounded-full bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white" asChild>
          <Link to="/employers/pricing">Upgrade</Link>
        </Button>
      </div>
    </div>
  </section>
);

export default HeroBanner;
