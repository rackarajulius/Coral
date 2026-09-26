import { Link } from "react-router-dom";
import { ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import aiIllustration from "@/assets/ai.png";
import AllowanceMeter from "./AllowanceMeter";
import { useCoachAllowanceGate } from "@/hooks/useCoachAllowanceGate";

export default function HeroBanner() {
  const { reset, openModal } = useInterviewSetupStore();
  // Checked before the wizard opens, not at its last step (see the hook).
  const { guard } = useCoachAllowanceGate();

  const startInterview = () => {
    reset();
    guard(() => openModal());
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-300 bg-card ">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-card blur-3xl"
      />
      <div className="relative flex items-center gap-8 p-8 md:p-12">
        {/* Copy + CTAs */}
        <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-display text-2xl font-semibold leading-[1.08] tracking-tight text-ink md:text-5xl">
            Practice smarter.
           
            Interview better.
          </h1>
          <p className="mt-5 max-w-md leading-relaxed text-ink-dim">
            Run realistic voice interviews with an AI interviewer that listens, probes deeper,
            and coaches you with live scoring — so the real interview feels like a rerun.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="default"
              size="lg"
              onClick={startInterview}
            >
              Start interview
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-ink/15 bg-transparent px-6 text-ink hover:bg-surface-2 hover:text-ink"
            >
              <Link to="/interview-prep/history">
                <History className="mr-2 h-4 w-4" aria-hidden="true" />
                View history
              </Link>
            </Button>
          </div>
          <AllowanceMeter />
        </div>

        {/* Illustration */}
        <img
          src={aiIllustration}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="hidden w-80 shrink-0 select-none rounded-2xl object-contain md:block lg:w-96 xl:w-[28rem]"
        />
      </div>
    </section>
  );
}
