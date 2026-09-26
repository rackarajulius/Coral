import { cn } from "@/lib/utils";
import type { AIState } from "@/data/interview-coach/types";

const RING: Record<AIState, string> = {
  speaking: "ring-state-speaking/50",
  listening: "ring-state-listening/50",
  thinking: "ring-state-thinking/50",
  evaluating: "ring-state-thinking/50",
  connecting: "ring-state-idle/40",
  paused: "ring-state-idle/30",
  idle: "ring-state-idle/30",
  error: "ring-danger/50",
};

/**
 * The interviewer's visual identity — a layered gradient orb whose halo and
 * motion communicate the current AI state.
 */
export default function AIOrb({
  state,
  size = 120,
  className,
}: {
  state: AIState;
  size?: number;
  className?: string;
}) {
  const busy = state === "thinking" || state === "evaluating" || state === "connecting";
  const talking = state === "speaking";
  const listening = state === "listening";

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size * 1.5, height: size * 1.5 }}
      aria-hidden="true"
    >
      {/* Outer halo */}
      <div
        className={cn(
          "absolute rounded-full blur-2xl transition-colors duration-700",
          talking && "bg-amber-400/25",
          listening && "bg-emerald-400/20",
          busy && "bg-violet-400/25",
          !talking && !listening && !busy && "bg-slate-400/10",
        )}
        style={{ width: size * 1.35, height: size * 1.35 }}
      />

      {/* Ring */}
      <div
        className={cn("absolute rounded-full ring-2 transition-colors duration-500", RING[state])}
        style={{ width: size * 1.12, height: size * 1.12 }}
      />

      {/* Core orb */}
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-br from-orange-300 via-coral to-orange-700 shadow-2xl transition-transform duration-500",
          talking && "scale-105",
          state === "paused" && "opacity-50 saturate-50",
        )}
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-[12%] rounded-full bg-gradient-to-tl from-transparent via-white/10 to-white/30" />
        <div className="absolute left-[22%] top-[18%] h-[18%] w-[26%] rounded-full bg-white/50 blur-[6px]" />
      </div>
    </div>
  );
}
