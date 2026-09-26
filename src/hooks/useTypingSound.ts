import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "msg:typingSound";

/**
 * Optional synthesized keyboard "click" for the message composer. No audio asset —
 * a short Web Audio blip per keystroke. Off by default; preference persisted.
 */
export function useTypingSound() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const ctxRef = useRef<AudioContext | null>(null);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;
    try {
      let ctx = ctxRef.current;
      if (!ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        ctxRef.current = ctx;
      }
      // Resume if the browser suspended it (needs a prior user gesture — typing is one).
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 470 + Math.random() * 240; // slight variation feels natural
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      /* audio unavailable — silently ignore */
    }
  }, [enabled]);

  return { enabled, toggle, play };
}
