import { ArrowRight, BadgeCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-background pt-16">
      <div className="relative z-10 container mx-auto px-4 md:px-12 lg:px-24 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Copy */}
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-coral/10 text-coral px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" /> For employers
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
              Meet your next hire, <span className="text-coral">faster</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Post a role and get matched with ready-to-talk candidates ranked by how well
              they fit — so you spend less time screening and more time hiring.
            </p>
            <div className="flex flex-col xs:flex-row items-center justify-center lg:justify-start gap-4">
              <Button variant="coral" size="lg" className="group w-full xs:w-auto h-12 px-8 text-base rounded-full" asChild>
                <Link to="/employers/jobs/post">
                  Post a job — free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full xs:w-auto h-12 px-8 text-base rounded-full" asChild>
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>

          {/* Illustrative candidate-match preview (not live data) */}
          <div className="relative hidden lg:block animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-coral/40" />
                  <span className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                  <span className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">Candidate matches</span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { initials: "AM", role: "Senior Product Designer", match: 94 },
                  { initials: "JT", role: "Full-Stack Engineer", match: 89 },
                  { initials: "RK", role: "Growth Marketer", match: 82 },
                ].map((c) => (
                  <div key={c.initials} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="h-10 w-10 rounded-full bg-coral/10 text-coral flex items-center justify-center text-sm font-semibold shrink-0">
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{c.role}</p>
                        <BadgeCheck className="h-3.5 w-3.5 text-coral shrink-0" />
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-coral" style={{ width: `${c.match}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{c.match}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
