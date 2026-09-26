import { cn } from "@/lib/utils";
import type { AIState } from "@/data/interview-coach/types";

const META: Record<AIState, { label: string; dot: string; pulse?: boolean }> = {
  connecting: { label: "Connecting", dot: "bg-state-idle", pulse: true },
  speaking: { label: "Nova is speaking", dot: "bg-state-speaking", pulse: true },
  listening: { label: "Listening — your turn", dot: "bg-state-listening", pulse: true },
  thinking: { label: "Analyzing your answer", dot: "bg-state-thinking", pulse: true },
  evaluating: { label: "Building your report", dot: "bg-state-thinking", pulse: true },
  paused: { label: "Paused", dot: "bg-state-idle" },
  idle: { label: "Ready", dot: "bg-state-idle" },
  error: { label: "Connection issue", dot: "bg-danger" },
};

export default function StateBadge({ state, className }: { state: AIState; className?: string }) {
  const meta = META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface/80 px-3 py-1 text-xs font-medium text-ink-dim",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {meta.pulse && (
          <span
            className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden", meta.dot)}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}
