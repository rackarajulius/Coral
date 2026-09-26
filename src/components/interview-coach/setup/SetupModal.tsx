import { useState } from "react";
import { isEntitlementError } from "@/lib/api/entitlementError";
import { isPracticeJobUnavailable } from "@/lib/api/interviewCoach";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { InterviewConfig } from "@/data/interview-coach/types";
import { useInterviewSessionStore } from "@/stores/interviewSessionStore";
import {
  STEP_TITLES,
  TOTAL_STEPS,
  canProceed,
  useInterviewSetupStore,
} from "@/stores/interviewSetupStore";
import StepDifficulty from "./StepDifficulty";
import StepExperience from "./StepExperience";
import StepPreferences from "./StepPreferences";
import StepReview from "./StepReview";
import StepRole from "./StepRole";
import StepType from "./StepType";

const STEP_COPY: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "What role are you interviewing for?",
    subtitle: "Enter the job title, and optionally add your resume so questions reference your background.",
  },
  2: {
    title: "Where are you in your career?",
    subtitle: "Nova calibrates the bar to your level.",
  },
  3: {
    title: "Pick your interview type",
    subtitle: "Each format evaluates a different mix of competencies.",
  },
  4: {
    title: "Set the difficulty",
    subtitle: "Choose the pressure level — or let the AI adapt as you go.",
  },
  5: {
    title: "Fine-tune the experience",
    subtitle: "Voice, pace, session length, and your microphone.",
  },
  6: {
    title: "Ready when you are",
    subtitle: "One last look before Nova joins the call.",
  },
};

/**
 * The 7-step interview setup wizard as a modal. Mounted once in CoachShell and
 * opened from anywhere via `useInterviewSetupStore().openModal()`.
 */
export default function SetupModal() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const {
    open, closeModal, step, direction, completed, config, next, back, goTo, reset, offlinePractice,
    set: setConfig,
  } = useInterviewSetupStore();
  const begin = useInterviewSessionStore((s) => s.begin);
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const [starting, setStarting] = useState(false);

  const startInterview = async (options?: { offline?: boolean }) => {
    setStarting(true);
    try {
      const sessionId = await begin(
        config as InterviewConfig,
        undefined,
        options ?? (offlinePractice ? { offline: true } : undefined),
      );
      closeModal();
      reset();
      navigate(`/interview-prep/session/${sessionId}`);
    } catch (error) {
      if (isEntitlementError(error)) {
        // The plan doesn't cover another AI interview. Say so, and let the
        // person choose the free scripted practice instead of getting it
        // silently.
        showUpgrade({
          code: error.code,
          metric: error.metric,
          tier: error.tier,
          resetsAt: error.resetsAt,
          message: error.message,
          alternative: {
            label: "Practice with the basic interviewer",
            run: () => void startInterview({ offline: true }),
          },
        });
      } else if (isPracticeJobUnavailable(error)) {
        // Said out loud, and undone only in the setup — the person starts
        // again knowingly, rather than getting practice that isn't about the job.
        setConfig({ practiceJob: undefined });
        toast.error(
          "That job isn't available to practise for any more. This is now general practice for the same role — press Start again.",
        );
      } else {
        toast.error("Couldn't reach the interviewer. Please try again.");
      }
    } finally {
      setStarting(false);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) next();
    else void startInterview();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent className="booth-light flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden border-ink/10 bg-booth p-0 text-ink">
        {/* Header */}
        <DialogHeader className="space-y-2 border-b border-ink/10 px-6 pb-4 pt-6 text-left">
          <p className="tabular text-xs font-medium uppercase tracking-wide text-ink-dim">
            New mock interview · step {step} of {TOTAL_STEPS}
          </p>
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">
            {STEP_COPY[step].title}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-dim">
            {/* Said up front so nobody mistakes the scripted interviewer for the AI one. */}
            {offlinePractice && (
              <span className="mb-1 block font-medium text-ink">
                Basic practice — a scripted interviewer, not AI, and not saved to your history.
              </span>
            )}
            {STEP_COPY[step].subtitle}
          </DialogDescription>

          {/* Step rail */}
          <ol className="flex items-center gap-1.5 pt-2" aria-label="Setup progress">
            {STEP_TITLES.map((label, i) => {
              const n = i + 1;
              const isActive = n === step;
              const isDone = completed.includes(n) && !isActive;
              const clickable = isDone || n <= Math.max(...completed, 0) + 1;
              return (
                <li key={label} className="flex-1">
                  <button
                    onClick={() => clickable && goTo(n)}
                    disabled={!clickable}
                    aria-label={`Step ${n}: ${label}`}
                    aria-current={isActive ? "step" : undefined}
                    title={label}
                    className={cn(
                      "flex w-full items-center justify-center rounded-full py-1 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !clickable && "cursor-default",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors",
                        isActive && "bg-coral",
                        isDone && "bg-coral/50",
                        !isActive && !isDone && "bg-surface-2",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        {/* Step body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {step === 1 && <StepRole />}
              {step === 2 && <StepExperience />}
              {step === 3 && <StepType />}
              {step === 4 && <StepDifficulty />}
              {step === 5 && <StepPreferences />}
              {step === 6 && <StepReview />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink/10 px-6 py-4">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 1}
            className="rounded-full text-ink-dim hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed(step, config) || starting}
            className="rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? (
              <>
                <span
                  className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Preparing…
              </>
            ) : step === TOTAL_STEPS ? (
              <>
                Start interview
                <Check className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
