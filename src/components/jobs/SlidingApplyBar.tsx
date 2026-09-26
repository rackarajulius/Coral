import { Bookmark, Heart, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Job } from "@/data/jobs";
import type { JobNextStep } from "./JobActions";
import { cn } from "@/lib/utils";
import { clsx } from "clsx";

interface SlidingApplyBarProps {
  job: Job;
  isVisible: boolean;
  isMobile: boolean;
  /** Same handler the main action row uses, so both routes stay identical. */
  onApply?: () => void;
  applied?: boolean;
  /** False while the person's applications are still loading — see JobActions. */
  appliedKnown?: boolean;
  /** After applying: practise, or the employer's screening. Same as the main row. */
  nextStep?: JobNextStep | null;
  onShare?: () => void;
}

const SlidingApplyBar = ({ job, isVisible, isMobile, onApply, applied = false, appliedKnown = true, nextStep, onShare }: SlidingApplyBarProps) => {
  
  return (
    <div
       className={clsx(
    "absolute left-0 right-0 z-30",
    "bg-card border-b border-border ",
    "px-6 py-3",
    "transition-transform duration-300 ease-in-out",
    "h-auto",

   
   isMobile ? "fixed bottom-0 z-[60]" : "absolute top-0 z-30",
    isVisible
      ? "translate-y-0"
      : isMobile
        ? "translate-y-full pointer-events-none"
        : "-translate-y-full pointer-events-none"
  )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-foreground truncate">
            {job.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{job.company}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Short by design: the bar is narrow and the full label already
              appeared on the card above before this bar could slide in. */}
          {applied && nextStep ? (
            <Button variant="coral" size="sm" onClick={nextStep.onClick}>
              {nextStep.kind === "screening" ? "Take screening" : "Practice interview"}
            </Button>
          ) : (
            <Button
              variant={applied ? "outline" : "coral"}
              size="sm"
              onClick={onApply}
              disabled={applied || !appliedKnown}
            >
              {applied ? "Applied" : "Apply"}
            </Button>
          )}
         <Button variant="outline" size="icon" className="h-8 w-8">
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onShare}
            aria-label="Share this job"
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SlidingApplyBar;
