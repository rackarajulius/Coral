import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { EmploymentType, Workplace } from "@/lib/api/resumeMatcher";
import {
  DEFAULT_FILTERS,
  WORKPLACE_LABELS,
  isFiltering,
  type MatchFilters,
  type MatchSort,
  type PostedWithin,
} from "@/lib/resumeMatcher/matchFilters";

const SORTS: Array<[MatchSort, string]> = [
  ["best", "Best match"],
  ["pay", "Highest pay"],
  ["newest", "Newest"],
];

const POSTED: Array<[PostedWithin, string]> = [
  [0, "Any time"],
  [1, "Past 24 hours"],
  [3, "Past 3 days"],
  [7, "Past week"],
  [30, "Past month"],
];

const TYPES: Array<[EmploymentType | "any", string]> = [
  ["any", "Any job type"],
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["temporary", "Temporary"],
  ["internship", "Internship"],
];

const PAY: Array<[number, string]> = [
  [0, "Any pay"],
  [40000, "40k+ a year"],
  [60000, "60k+ a year"],
  [80000, "80k+ a year"],
  [100000, "100k+ a year"],
  [120000, "120k+ a year"],
];

/**
 * One filter's choices in a non-modal popover, so the page still scrolls and
 * takes clicks while it is open. Picking a choice closes it.
 */
function FilterPopover<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(([v]) => v === value)?.[1] ?? options[0][1];

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          className="flex h-9 min-w-[8.5rem] items-center justify-between gap-2 rounded-full border border-gray-300 bg-background px-3 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span>{current}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-[var(--radix-popover-trigger-width)] p-1">
        <div role="listbox" aria-label={label}>
          {options.map(([v, text]) => (
            <button
              key={String(v)}
              type="button"
              role="option"
              aria-selected={v === value}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className="relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            >
              {v === value && <Check className="absolute left-2 h-4 w-4" />}
              {text}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Sort and narrow the matches on the page.
 *
 * Works on the results already found, so changing a filter is instant and
 * spends no web searches. A filter keeps only jobs that state what it asks
 * about, which the empty state explains.
 */
export function MatchFilterBar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: MatchFilters;
  onChange: (next: MatchFilters) => void;
  shown: number;
  total: number;
}) {
  const set = <K extends keyof MatchFilters>(key: K, value: MatchFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    // The line runs the full screen width while the controls stay in the page column.
    <div className="relative mb-5 space-y-3 pb-4 after:absolute after:bottom-0 after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-gray-300 after:content-['']">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <FilterPopover label="Sort matches" value={filters.sort} options={SORTS} onChange={(v) => set("sort", v)} />
        <FilterPopover label="Date posted" value={filters.postedWithin} options={POSTED} onChange={(v) => set("postedWithin", v)} />
        <FilterPopover label="Job type" value={filters.employmentType} options={TYPES} onChange={(v) => set("employmentType", v)} />
        <FilterPopover label="Minimum pay" value={filters.minYearlyPay} options={PAY} onChange={(v) => set("minYearlyPay", v)} />

        <ToggleGroup
          type="multiple"
          value={filters.workplaces}
          onValueChange={(v) => set("workplaces", v as Workplace[])}
          aria-label="Workplace"
          className="gap-1"
        >
          {(Object.keys(WORKPLACE_LABELS) as Workplace[]).map((w) => (
            <ToggleGroupItem key={w} value={w} size="sm" variant="outline" className="h-9 rounded-full border-gray-300 px-3 text-sm">
              {WORKPLACE_LABELS[w]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isFiltering(filters) && (
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
          <span>
            Showing {shown} of {total} matches
          </span>
          <Button variant="link" size="sm" className="h-auto p-0 text-coral" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
