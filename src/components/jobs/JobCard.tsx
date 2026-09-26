import { useState, useRef, useCallback } from "react";
import { MapPin, Bookmark, Check, X } from "lucide-react";
import { Job } from "@/data/jobs";
import { useSavedJob } from "@/hooks/useSavedJob";
import { cn, resolveJobIcon } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface JobCardProps {
  job: Job;
  isSelected: boolean;
  onClick: () => void;
  /** AI fit for this job. `score: null` = we can't judge; undefined = not scored yet. */
  match?: { score: number | null; reason: string | null };
}

/** Bands are deliberately coarse — a 2-point gap isn't a meaningful difference. */
function matchTone(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

const JobCard = ({ job, isSelected, onClick, match }: JobCardProps) => {
  const isMobile = useIsMobile();
  const { isSaved: isBookmarked, toggle: toggleSave } = useSavedJob(job);

  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  // Swipe thresholds
  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE_DISTANCE = 120;

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prompt sign-in when needed, then persist the save/unsave.
    toggleSave();
  };

  // Touch event handlers for swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    setIsSwipeActive(true);
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isSwipeActive) return;

    const touch = e.touches[0];
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const deltaX = touch.clientX - centerX;

    // Limit swipe distance
    const limitedDeltaX = Math.max(-MAX_SWIPE_DISTANCE, Math.min(MAX_SWIPE_DISTANCE, deltaX));

    setSwipeOffset(limitedDeltaX);

    // Determine swipe direction
    if (Math.abs(limitedDeltaX) > 20) {
      setSwipeDirection(limitedDeltaX > 0 ? 'right' : 'left');
    }
  }, [isMobile, isSwipeActive]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isSwipeActive) return;

    const absOffset = Math.abs(swipeOffset);

    // Check if swipe threshold was met
    if (absOffset >= SWIPE_THRESHOLD) {
      if (swipeDirection === 'right') {
        // Swipe right to save/bookmark
        handleBookmarkClick({ stopPropagation: () => {} } as React.MouseEvent);
      } else if (swipeDirection === 'left') {
        // Swipe left to apply (simulate click)
        onClick();
      }
    }

    // Reset swipe state
    setSwipeOffset(0);
    setSwipeDirection(null);
    setIsSwipeActive(false);
  }, [isMobile, isSwipeActive, swipeOffset, swipeDirection, onClick]);

  // Get swipe action styles
  const getSwipeStyles = () => {
    if (!isMobile) return {};

    const absOffset = Math.abs(swipeOffset);
    const progress = Math.min(absOffset / SWIPE_THRESHOLD, 1);

    return {
      transform: `translateX(${swipeOffset}px)`,
      transition: isSwipeActive ? 'none' : 'transform 0.3s ease-out',
    };
  };

  // Get background color based on swipe direction and progress
  const getBackgroundColor = () => {
    // Always maintain white background for job cards
    return 'white';
  };

  return (
    <div className="relative">
      {/* Swipe Action Indicators (Mobile Only) */}
      {isMobile && (
        <>
          {/* Save Indicator (Right Swipe) */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-20 flex items-center justify-start pr-4 transition-opacity duration-200 z-10",
              swipeDirection === 'right' && isSwipeActive ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="bg-green-500 text-white rounded-full p-2 shadow-lg">
              <Bookmark className="h-5 w-5" />
            </div>
          </div>

          {/* Apply Indicator (Left Swipe) */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-20 flex items-center justify-end pl-4 transition-opacity duration-200 z-10",
              swipeDirection === 'left' && isSwipeActive ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="bg-blue-500 text-white rounded-full p-2 shadow-lg">
              <Check className="h-5 w-5" />
            </div>
          </div>
        </>
      )}

      <button
        ref={cardRef}
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          ...getSwipeStyles(),
        }}
        className={cn(
          "w-full text-left relative rounded-xl border transition-all duration-200",
          "p-4 sm:p-5 bg-card",
          "hover:bg-coral/5 hover:border-coral/30",
          isSelected
            ? "border-coral bg-coral/5 shadow-md"
            : "border-border",
          // Disable hover effects during swipe
          isSwipeActive && "hover:bg-card hover:border-border"
        )}
      >
      {/* Content */}
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Logo */}
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted
         shadow-inner flex items-center justify-center overflow-hidden p-1.5">
          <img
            src={resolveJobIcon(job.icon)}
            alt={`${job.company} logo`}
            className="h-full rounded-sm w-full object-contain"
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-display font-semibold text-foreground truncate text-sm sm:text-base">
            {job.title}
          </h3>

          {/* Company */}
          <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 truncate">
            {job.company}
          </p>

          {/* Meta Info */}
          <div className="flex flex-col gap-1 text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>

            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-[10px] sm:text-[11px]">{job.type}</span>
              <span>{job.salary}</span>
            </div>
          </div>
        </div>

        {/* Right column: Bookmark + Timestamp */}
        <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
          {/* Bookmark */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleBookmarkClick}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              handleBookmarkClick(e as unknown as React.MouseEvent)
            }
            className={cn(
              "p-1.5 rounded-full transition",
              "cursor-pointer hover:bg-card",
              isBookmarked
                ? "text-coral"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark
              className={cn("h-5 w-5", isBookmarked && "fill-current")}
            />
          </div>

          {/* AI fit — only shown once we have a real score for this job. */}
          {match?.score != null && (
            <span
              title={match.reason ?? undefined}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap",
                matchTone(match.score),
              )}
            >
              {match.score}% match
            </span>
          )}

          {/* Timestamp - aligned with salary */}
          <span className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
            {job.postedAt}
          </span>
        </div>
      </div>
    </button>

    {/* Swipe Hint for Mobile */}
    {isMobile && !isSwipeActive && (
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground opacity-50">
        👆 Swipe to save or apply
      </div>
    )}
    </div>
  );
};

export default JobCard;
