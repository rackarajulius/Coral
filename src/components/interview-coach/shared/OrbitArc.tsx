import { cn } from "@/lib/utils";

/**
 * A bright arc that travels around a circular rim, marking whose turn it is.
 *
 * Spinning a full ring reads as static, so the conic gradient leaves a gap and
 * the radial mask keeps only the rim — what you see orbiting is that gap's edge.
 * Absolutely positioned: place it inside a `relative` box that centers children.
 */
export default function OrbitArc({
  size,
  colorVar,
  active,
  durationSec = 1.8,
  thickness = 3,
  className,
}: {
  size: number;
  /** CSS custom property holding the hue, e.g. "--state-listening". */
  colorVar: string;
  active: boolean;
  durationSec?: number;
  thickness?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute rounded-full transition-opacity duration-500",
        active ? "opacity-100 animate-spin motion-reduce:animate-none" : "opacity-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        animationDuration: `${durationSec}s`,
        background: `conic-gradient(from 0deg, transparent 0%, hsl(var(${colorVar}) / 0.9) 18%, transparent 40%)`,
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
      }}
      aria-hidden="true"
    />
  );
}
