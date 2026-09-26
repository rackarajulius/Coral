import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterGroup {
  group: string;
  label: string;
  options: string[];
}

interface FiltersBarProps {
  filterGroups: FilterGroup[];
  activeFilters: string[];
  onToggleFilter: (value: string) => void;
  onClearAll: () => void;
}

export function FiltersBar({
  filterGroups,
  activeFilters,
  onToggleFilter,
  onClearAll,
}: FiltersBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {filterGroups.map((group) => (
        <div key={group.group} className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {group.label}:
          </span>
          {group.options.map((option) => {
            const active = activeFilters.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggleFilter(option)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  active
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground"
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ))}

      {activeFilters.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
