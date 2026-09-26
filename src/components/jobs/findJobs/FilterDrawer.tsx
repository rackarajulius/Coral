import { X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppDispatch";
import {
  setFilterDrawerOpen,
  toggleJobType,
  toggleExperienceLevel,
  setDatePosted,
  toggleRemote,
  resetFilters,
} from "@/store/jobsSlice";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const jobTypes = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"];
const experienceLevels = ["Entry Level", "Mid Level", "Senior", "Lead", "Executive"];
const dateOptions = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const FilterDrawer = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.jobs.isFilterDrawerOpen);
  const filters = useAppSelector((state) => state.jobs.filters);
  const isMobile = useIsMobile();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => dispatch(setFilterDrawerOpen(false))}
      />

      {/* Desktop: Left Drawer | Mobile: Bottom Sheet */}
      <div
        className={cn(
          "fixed bg-card z-50 shadow-xl",
          "transition-transform duration-300 ease-in-out",
          "overflow-y-auto scrollbar",
          // Desktop: Left sidebar drawer
          "md:top-0 md:left-0 md:h-full md:w-[300px] md:max-w-[85vw]",
          isOpen ? "md:translate-x-0" : "md:-translate-x-full",
          // Mobile: Bottom sheet
          "max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[85vh] max-md:rounded-t-lg border-t border-border",
          isOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"
        )}
      >
        {/* Mobile: Drag handle indicator */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 bg-muted-foreground/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-semibold text-lg">Filters</h2>
          <button
            onClick={() => dispatch(setFilterDrawerOpen(false))}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Job Type */}
          <div>
            <h3 className="font-medium text-sm mb-3">Job Type</h3>
            <div className="space-y-2">
              {jobTypes.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.jobType.includes(type)}
                    onCheckedChange={() => dispatch(toggleJobType(type))}
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Experience Level */}
          <div>
            <h3 className="font-medium text-sm mb-3">Experience Level</h3>
            <div className="space-y-2">
              {experienceLevels.map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.experienceLevel.includes(level)}
                    onCheckedChange={() => dispatch(toggleExperienceLevel(level))}
                  />
                  <span className="text-sm">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Posted */}
          <div>
            <h3 className="font-medium text-sm mb-3">Date Posted</h3>
            <div className="space-y-2">
              {dateOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="datePosted"
                    checked={filters.datePosted === option.value}
                    onChange={() => dispatch(setDatePosted(option.value))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Remote */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.remote}
                onCheckedChange={() => dispatch(toggleRemote())}
              />
              <span className="text-sm font-medium">Remote only</span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dispatch(resetFilters())}
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => dispatch(setFilterDrawerOpen(false))}
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterDrawer;
