import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type WaveVariant = "speaking" | "listening" | "thinking" | "idle";

const VAR_FOR: Record<WaveVariant, string> = {
  speaking: "--state-speaking",
  listening: "--state-listening",
  thinking: "--state-thinking",
  idle: "--state-idle",
};

function cssHsl(variant: WaveVariant, alpha = 1) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(VAR_FOR[variant])
    .trim();
  return `hsl(${raw} / ${alpha})`;
}

/**
 * Canvas equalizer used everywhere the AI "voice" is visualized.
 * - Without `dataRef`: synthetic phase-shifted sine bars (AI speaking/thinking).
 * - With `dataRef`: real microphone frequency data (candidate speaking).
 * Honors prefers-reduced-motion by rendering a static frame.
 */
export default function WaveformBars({
  variant,
  dataRef,
  bars = 32,
  className,
  height = 64,
}: {
  variant: WaveVariant;
  /** Live frequency bins from useMicLevel — read every frame, never state. */
  dataRef?: React.RefObject<Uint8Array | null>;
  bars?: number;
  className?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = cssHsl(variant);
    const faint = cssHsl(variant, 0.35);

    let raf = 0;
    let running = true;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);

      const gap = 3;
      const barW = Math.max(2, (w - gap * (bars - 1)) / bars);
      const mid = h / 2;
      const live = dataRef?.current;

      for (let i = 0; i < bars; i++) {
        let amp: number; // 0..1
        if (live && live.length > 0) {
          const bin = live[Math.floor((i / bars) * Math.min(live.length, bars * 2))] ?? 0;
          amp = bin / 255;
        } else if (variant === "idle") {
          amp = 0.06 + 0.03 * Math.sin(t / 900 + i * 0.4);
        } else if (variant === "thinking") {
          amp = 0.12 + 0.1 * Math.sin(t / 500 + i * 0.9) * Math.sin(t / 1700);
        } else {
          // speaking / listening synthetic voice
          amp =
            0.18 +
            0.42 * Math.abs(Math.sin(t / 260 + i * 0.55)) * (0.55 + 0.45 * Math.sin(t / 730 + i));
        }

        const bh = Math.max(2, amp * (h - 6));
        const x = i * (barW + gap);
        ctx.fillStyle = i % 2 === 0 ? color : faint;
        const r = Math.min(barW / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, mid - bh / 2, barW, bh, r);
        ctx.fill();
      }
    };

    if (reduced && !dataRef) {
      draw(1000); // one static frame
      return;
    }

    const loop = (t: number) => {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [variant, bars, dataRef]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden="true"
    />
  );
}
