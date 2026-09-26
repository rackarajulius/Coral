import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LEVELS } from "@/data/interview-coach/constants";
import type { Difficulty } from "@/data/interview-coach/types";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

export default function StepDifficulty() {
  const difficulty = useInterviewSetupStore((s) => s.config.difficulty) ?? 2;
  const adaptive = useInterviewSetupStore((s) => s.config.adaptive) ?? false;
  const set = useInterviewSetupStore((s) => s.set);

  const current = DIFFICULTY_LEVELS.find((l) => l.id === difficulty)!;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-ink/10 bg-surface p-8">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold text-ink">{current.label}</p>
          <p className="mt-1 text-sm text-ink-dim">{current.blurb}</p>
        </div>

        <Slider
          value={[difficulty]}
          min={1}
          max={4}
          step={1}
          onValueChange={([v]) => set({ difficulty: v as Difficulty })}
          aria-label="Interview difficulty"
          className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-coral [&_[role=slider]]:bg-coral"
        />

        <div className="mt-4 flex justify-between">
          {DIFFICULTY_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => set({ difficulty: l.id })}
              className={cn(
                "rounded px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                difficulty === l.id ? "font-semibold text-coral" : "text-ink-dim hover:text-ink",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-5">
        <div>
          <p className="text-sm font-semibold text-ink">Adaptive AI difficulty</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-dim">
            Nova raises the bar when you're cruising and eases off when you're struggling —
            like a real interviewer reading the room.
          </p>
        </div>
        <Switch
          checked={adaptive}
          onCheckedChange={(v) => set({ adaptive: v })}
          aria-label="Adaptive AI difficulty"
          className="data-[state=checked]:bg-coral"
        />
      </div>
    </div>
  );
}
