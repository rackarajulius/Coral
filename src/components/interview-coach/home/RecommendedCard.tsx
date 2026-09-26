import { ArrowUpRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { difficultyLabel, interviewTypeLabel } from "@/data/interview-coach/constants";
import type { Difficulty, InterviewType } from "@/data/interview-coach/types";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

export interface Recommendation {
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  minutes: number;
  skills: string[];
}

export default function RecommendedCard({ rec }: { rec: Recommendation }) {
  const { reset, set, goTo, openModal } = useInterviewSetupStore();

  const start = () => {
    // Prefill the wizard and drop the user on Review — one click from starting.
    reset();
    set({
      role: rec.role,
      type: rec.type,
      difficulty: rec.difficulty,
      durationMin: rec.minutes,
      focusSkills: rec.skills,
    });
    goTo(7);
    openModal();
  };

  return (
    <div className="flex w-72 shrink-0 flex-col justify-between rounded-2xl border border-ink/10 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-coral/40 motion-reduce:hover:translate-y-0">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink">{rec.role}</h3>
          <Badge variant="outline" className="shrink-0">
            {difficultyLabel(rec.difficulty)}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-dim">
          {interviewTypeLabel(rec.type)}
          <span aria-hidden="true">·</span>
          <Clock className="h-3 w-3" aria-hidden="true" />~{rec.minutes} min
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {rec.skills.map((s) => (
            <Badge key={s} variant="secondary" className="font-medium">
              {s}
            </Badge>
          ))}
        </div>
      </div>
      <Button
        onClick={start}
        variant="ghost"
        className="mt-5 w-full justify-between rounded-xl bg-surface-2 text-sm text-ink hover:bg-coral hover:text-white"
      >
        Start practice
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
