import { cn } from "@/lib/utils";

function toneFor(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-rose-400";
}

/** Circular score indicator (0–100) with the value centered. */
export default function ScoreRing({
  score,
  size = 96,
  strokeWidth = 8,
  label,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="img"
      aria-label={`${label ?? "Score"}: ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-ink/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          className={cn("transition-[stroke-dasharray] duration-700 ease-out", toneFor(score), "stroke-current")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-2xl font-semibold text-ink">{score}</span>
        {label && <span className="text-[10px] uppercase tracking-wide text-ink-dim">{label}</span>}
      </div>
    </div>
  );
}
