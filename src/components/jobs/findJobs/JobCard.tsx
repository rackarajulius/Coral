import { useState } from "react";
import { MapPin, Clock, DollarSign, Bookmark } from "lucide-react";
import { Job } from "@/data/jobs/jobs";
import { cn, resolveJobIcon } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  isSelected: boolean;
  onClick: () => void;
}

const JobCard = ({ job, isSelected, onClick }: JobCardProps) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
  };

  return (
    <button
      onClick={onClick}
      className={cn(
         "w-full text-left relative rounded-xl border transition-all duration-200",
  "p-4 sm:p-5 bg-card",

  "hover:bg-orange-50 dark:hover:bg-orange-950 hover:border-orange-300",

  isSelected
    ? "border-orange-300 bg-orange-500/10 shadow-sm"
    : "border-border dark:border-orange-700"
      )}
    >
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
         "absolute top-3 right-3 p-1.5 rounded-full transition-colors duration-200",
             "cursor-pointer hover:bg-muted",
          isBookmarked
        ? "text-amber-500"
        : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Bookmark
          className={cn("h-5 w-5", isBookmarked && "fill-current")}
        />
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 sm:gap-4 pr-8">
        {/* Logo */}
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted shadow-inner flex items-center justify-center overflow-hidden p-1.5">
          <img
            src={resolveJobIcon(job.icon)}
            alt={`${job.company} logo`}
            className="h-full w-full object-contain"
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
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>

            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.type}
            </span>

            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.postedAt}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {job.salary}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default JobCard;