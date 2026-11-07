import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const trigger = "h-9 w-auto min-w-[8.5rem] rounded-full text-sm";

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.sort} onValueChange={(v) => set("sort", v as MatchSort)}>
          <SelectTrigger className={trigger} aria-label="Sort matches">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(filters.postedWithin)} onValueChange={(v) => set("postedWithin", Number(v) as PostedWithin)}>
          <SelectTrigger className={trigger} aria-label="Date posted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTED.map(([value, label]) => (
              <SelectItem key={value} value={String(value)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.employmentType} onValueChange={(v) => set("employmentType", v as MatchFilters["employmentType"])}>
          <SelectTrigger className={trigger} aria-label="Job type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(filters.minYearlyPay)} onValueChange={(v) => set("minYearlyPay", Number(v))}>
          <SelectTrigger className={trigger} aria-label="Minimum pay">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAY.map(([value, label]) => (
              <SelectItem key={value} value={String(value)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="multiple"
          value={filters.workplaces}
          onValueChange={(v) => set("workplaces", v as Workplace[])}
          aria-label="Workplace"
          className="gap-1"
        >
          {(Object.keys(WORKPLACE_LABELS) as Workplace[]).map((w) => (
            <ToggleGroupItem key={w} value={w} size="sm" variant="outline" className="h-9 rounded-full px-3 text-sm">
              {WORKPLACE_LABELS[w]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isFiltering(filters) && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
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
