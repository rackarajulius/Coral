import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { STEPS } from "@/data/companyProfile/employer-brand-schema";

interface Props {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (id: number) => void;
}

export function HorizontalStepper({ currentStep, completedSteps, onStepClick }: Props) {
  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden md:flex items-center w-full">
        {STEPS.map((step, i) => {
          const isActive = currentStep === step.id;
          const isCompleted = completedSteps.has(step.id) && !isActive;
          const isPast = step.id < currentStep;
          const isClickable = step.id <= currentStep || completedSteps.has(step.id);
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-initial">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                title={!isClickable ? "Complete the current step to continue" : undefined}
                className={cn("group flex items-center gap-3 min-w-0", !isClickable && "cursor-not-allowed opacity-50")}
              >
                <motion.div
                  layout
                  className={cn(
                    "relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all border duration-200",
                    isActive &&
                      "bg-orange-500 text-white border-orange-400 ring-4 ring-orange-500/20 shadow-sm",
                    isCompleted &&
                      "bg-orange-500 text-white border-orange-500 shadow-sm",
                    !isActive && !isCompleted &&
                      "bg-card text-muted-foreground border-border group-hover:border-foreground/40"
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : step.id}
                </motion.div>
                <div className="min-w-0 text-left">
                  <div
                    className={cn(
                      "text-sm font-semibold leading-tight transition-colors",
                      isActive ? "text-foreground" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight truncate">
                    {step.description}
                  </div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className="relative mx-3 h-[2px] flex-1 overflow-hidden rounded-full bg-orange-200 dark:bg-slate-700">
                  <motion.div
                    initial={false}
                    animate={{ width: isPast || isCompleted ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-orange-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile compact */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </div>
            <div className="text-base font-semibold">{STEPS[currentStep - 1]?.label}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {completedSteps.size}/{STEPS.length} done
          </div>
        </div>
        <div className="h-1.5 w-full bg-orange-200 rounded-full overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
          />
        </div>
      </div>
    </div>
  );
}