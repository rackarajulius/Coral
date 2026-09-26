import { EXPERIENCE_LEVELS } from "@/data/interview-coach/constants";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import SelectCard from "./SelectCard";

export default function StepExperience() {
  const experience = useInterviewSetupStore((s) => s.config.experience);
  const set = useInterviewSetupStore((s) => s.set);

  return (
    <div role="radiogroup" aria-label="Experience level" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {EXPERIENCE_LEVELS.map((level) => (
        <SelectCard
          key={level.id}
          selected={experience === level.id}
          onSelect={() => set({ experience: level.id })}
          title={level.label}
          meta={level.years}
          description={level.blurb}
        />
      ))}
    </div>
  );
}
