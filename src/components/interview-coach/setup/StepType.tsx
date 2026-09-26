import { Badge } from "@/components/ui/badge";
import { INTERVIEW_TYPES, competencyLabel } from "@/data/interview-coach/constants";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import SelectCard from "./SelectCard";

export default function StepType() {
  const type = useInterviewSetupStore((s) => s.config.type);
  const set = useInterviewSetupStore((s) => s.set);

  return (
    <div role="radiogroup" aria-label="Interview type" className="grid gap-3 sm:grid-cols-2">
      {INTERVIEW_TYPES.map((t) => (
        <SelectCard
          key={t.id}
          selected={type === t.id}
          onSelect={() => set({ type: t.id })}
          title={t.label}
          description={t.blurb}
        >
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.competencies.map((c) => (
              <Badge key={c} variant="secondary" className="font-medium">
                {competencyLabel(c)}
              </Badge>
            ))}
          </div>
        </SelectCard>
      ))}
    </div>
  );
}
