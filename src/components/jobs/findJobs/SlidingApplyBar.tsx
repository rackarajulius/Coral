import { Bookmark, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Job } from "@/data/jobs/jobs";
import { cn } from "@/lib/utils";
import { clsx } from "clsx";

interface SlidingApplyBarProps {
  job: Job;
  isVisible: boolean;
  isMobile: boolean;
  /** Provided by JobDetails so the bar shares one apply state. */
  onApply?: () => void;
  applied?: boolean;
  /** Overrides the button text for external / email application routes. */
  applyLabel?: string;
}

const SlidingApplyBar = ({ job, isVisible, isMobile, onApply, applied = false, applyLabel }: SlidingApplyBarProps) => {
  
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
          <Button variant="default" size="sm" onClick={onApply} disabled={applied}>
            {applyLabel ?? (applied ? "Applied" : "Apply")}
          </Button>
         <Button variant="outline" size="icon" className="h-8 w-8">
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SlidingApplyBar;
