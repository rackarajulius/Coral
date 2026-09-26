import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import AIOrb from "../shared/AIOrb";

const MESSAGES = [
  "Analyzing your communication…",
  "Evaluating technical depth…",
  "Reviewing answer structure…",
  "Measuring confidence signals…",
  "Generating recommendations…",
  "Building your personalized report…",
];

/** Full-screen "evaluating" phase shown while the engine writes the report. */
export default function GeneratingReport() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const msgTimer = setInterval(
      () => setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1)),
      950,
    );
    // Ease toward 95% — the navigation away is the real 100%.
    const progTimer = setInterval(
      () => setProgress((p) => Math.min(95, p + Math.max(1, (95 - p) * 0.12))),
      180,
    );
    return () => {
      clearInterval(msgTimer);
      clearInterval(progTimer);
    };
  }, []);

  return (
    // booth-light is set here, not inherited: the session early-returns this
    // above its own wrapper, so bg-booth would otherwise resolve dark.
    <div className="booth-light fixed inset-0 z-50 grid place-items-center bg-booth">
      <div className="flex w-full max-w-sm flex-col items-center px-6 text-center">
        <AIOrb state="evaluating" size={110} />
        <h1 className="mt-6 font-display text-xl font-semibold text-ink">
          Grading your interview
        </h1>
        <div className="mt-2 h-6" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-ink-dim"
            >
              {MESSAGES[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        <Progress
          value={progress}
          className="mt-8 h-1.5 w-full bg-surface-2 [&>div]:bg-coral"
          aria-label="Report progress"
        />
        <p className="tabular mt-3 text-[11px] text-ink-dim">usually takes a few seconds</p>
      </div>
    </div>
  );
}
