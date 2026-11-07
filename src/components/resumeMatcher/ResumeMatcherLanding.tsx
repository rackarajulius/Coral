import { ArrowRight, Check, FileText, Globe2, MapPin, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { BRAND_NAME } from "@/lib/brand";
import { JobsTabs } from "@/components/jobs/JobsTabs";

const steps = [
  {
    icon: FileText,
    title: "Bring your experience",
    description: "Create your job seeker profile. Import your resume or add your skills and experience yourself.",
  },
  {
    icon: Target,
    title: "Find your fit",
    description: "Get jobs ranked against your profile. Explore your match scores and refine by role, location, and work style.",
  },
  {
    icon: ArrowRight,
    title: "Take the next step",
    description: "Save the roles you like and track your applications. Access cover-letter and resume-tailoring tools from your matches.",
  },
];

export default function ResumeMatcherLanding({ onGetMatches }: { onGetMatches: () => void }) {
  return (
    <>
      <main className="pt-16">
        <JobsTabs />
        <section aria-labelledby="matcher-heading" className="border-b border-border bg-gradient-to-b from-coral/5 to-background">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-coral/20 bg-card px-3 py-1.5 text-xs font-semibold text-coral">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI Job Match
              </div>
              <h1 id="matcher-heading" className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Find jobs that fit
                <span className="block text-coral">your experience.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Turn your resume into a shortlist. Discover roles matched to your skills,
                understand why they fit, and focus on your next application.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button variant="coral" size="lg" className="rounded-full" onClick={onGetMatches}>
                  Get my matches <ArrowRight aria-hidden="true" />
                </Button>
                <Button variant="outline" size="lg" className="rounded-full" asChild>
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Start free with jobs on {BRAND_NAME}. No payment needed.
              </p>
            </div>

            <div className="min-w-0 rounded-3xl border border-border bg-card p-5 shadow-lg shadow-coral/5 sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">A clearer picture of your fit</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Illustrative example</span>
              </div>
              <div className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">Product Designer</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Example company</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Remote · Full-time
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-coral/10 px-3 py-2 text-center">
                    <p className="text-2xl font-bold text-coral">92%</p>
                    <p className="text-[11px] font-medium text-coral">Match</p>
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-5">
                  <p className="text-sm font-medium text-foreground">Why this role fits</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your experience in user research and interface design aligns with this role’s focus on building intuitive products.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["User research", "UI design", "Prototyping"].map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">
                        <Check className="h-3 w-3 text-coral" aria-hidden="true" /> {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                Your skills and experience help you decide where to apply next.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-it-works-heading" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-coral">From resume to opportunity</p>
          <h2 id="how-it-works-heading" className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">Less searching. More direction.</h2>
          <div className="mt-9 grid gap-8 md:grid-cols-3 md:gap-10">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <div key={title}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10 text-coral">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="matching-plans-heading" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="overflow-hidden rounded-3xl border border-border bg-card md:grid md:grid-cols-2">
            <div className="p-6 sm:p-8">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Start with Free</span>
              <h2 id="matching-plans-heading" className="mt-3 text-2xl font-bold text-foreground">Find your fit on {BRAND_NAME}.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Match your profile against jobs posted on {BRAND_NAME}, see why they fit, and save the ones you want to explore.
              </p>
              <Button variant="coral" className="mt-6 rounded-full" onClick={onGetMatches}>
                Get my matches <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <div className="border-t border-border bg-coral/5 p-6 sm:p-8 md:border-l md:border-t-0">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-coral">
                <Globe2 className="h-4 w-4" aria-hidden="true" /> Go further with Premium
              </span>
              <h3 className="mt-3 text-2xl font-bold text-foreground">Go beyond the job board.</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Add jobs from across the web to your matches. Explore Premium’s application tools, current allowances, and pricing.
              </p>
              <Button variant="outline" className="mt-6 rounded-full" asChild>
                <Link to="/premium">Explore Premium <ArrowRight aria-hidden="true" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
