import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Job, mockJobs } from "@/data/admin/job/jobs";

export interface Filters {
  statuses: Job["status"][];
  types: Job["type"][];
  location: string;
  dateFrom: string;
  dateTo: string;
  salaryMin: string;
  salaryMax: string;
  minApplications: string;
  company: string;
  industry: string;
  flaggedOnly: boolean;
}

export const defaultFilters: Filters = {
  statuses: [],
  types: [],
  location: "",
  dateFrom: "",
  dateTo: "",
  salaryMin: "",
  salaryMax: "",
  minApplications: "",
  company: "",
  industry: "",
  flaggedOnly: false,
};

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const statuses: Job["status"][] = ["Active", "Pending", "Flagged", "Rejected", "Expired"];
const types: Job["type"][] = ["Full-time", "Part-time", "Contract", "Internship"];
const locations = [
  { label: "All locations", value: "" },
  { label: "Toronto, CA", value: "toronto" },
  { label: "Calgary, CA", value: "calgary" },
  { label: "Vancouver, CA", value: "vancouver" },
  { label: "Ottawa, CA", value: "ottawa" },
  { label: "Montreal, CA", value: "montreal" },
  { label: "Edmonton, CA", value: "edmonton" },
  { label: "Waterloo, CA", value: "waterloo" },
  { label: "Remote", value: "remote" },
];

const companies = Array.from(new Set(mockJobs.map((j) => j.company))).sort();
const industries = Array.from(new Set(mockJobs.map((j) => j.industry).filter(Boolean))).sort() as string[];

export function FilterPanel({ open, onClose, filters, onChange }: FilterPanelProps) {
  const toggleStatus = (s: Job["status"]) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  };

  const toggleType = (t: Job["type"]) => {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types: next });
  };

  const activeCount =
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.salaryMin || filters.salaryMax ? 1 : 0) +
    (filters.minApplications ? 1 : 0) +
    (filters.company ? 1 : 0) +
    (filters.industry ? 1 : 0) +
    (filters.flaggedOnly ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-[360px] p-0 flex flex-col">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-card text-accent-foreground text-xs font-medium">
                {activeCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Status</Label>
            <div className="space-y-2">
              {statuses.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.statuses.includes(s)}
                    onCheckedChange={() => toggleStatus(s)}
                  />
                  <span className="text-sm text-muted-foreground">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Date Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={filters.dateFrom}
                  onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={filters.dateTo}
                  onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Location</Label>
            <Select
              value={filters.location}
              onValueChange={(v) => onChange({ ...filters, location: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.value || "__all"} value={loc.value || "__all"}>{loc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employment Type */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Employment Type</Label>
            <div className="space-y-2">
              {types.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.types.includes(t)}
                    onCheckedChange={() => toggleType(t)}
                  />
                  <span className="text-sm text-muted-foreground">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Salary Range */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Salary Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Min"
                type="number"
                className="h-9 text-sm"
                value={filters.salaryMin}
                onChange={(e) => onChange({ ...filters, salaryMin: e.target.value })}
              />
              <Input
                placeholder="Max"
                type="number"
                className="h-9 text-sm"
                value={filters.salaryMax}
                onChange={(e) => onChange({ ...filters, salaryMax: e.target.value })}
              />
            </div>
          </div>

          {/* Applications Range */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Min Applications</Label>
            <Input
              placeholder="0"
              type="number"
              className="h-9 text-sm"
              value={filters.minApplications}
              onChange={(e) => onChange({ ...filters, minApplications: e.target.value })}
            />
          </div>

          {/* Company */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Company</Label>
            <Select
              value={filters.company}
              onValueChange={(v) => onChange({ ...filters, company: v === "__all" ? "" : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industry */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">Industry</Label>
            <Select
              value={filters.industry}
              onValueChange={(v) => onChange({ ...filters, industry: v === "__all" ? "" : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All industries</SelectItem>
                {industries.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flagged Only */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">Flagged Only</Label>
            <Switch
              checked={filters.flaggedOnly}
              onCheckedChange={(v) => onChange({ ...filters, flaggedOnly: v })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-border">
          <Button variant="outline" className="flex-1 gap-2 bg-card border-border" onClick={() => onChange(defaultFilters)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button className="flex-1" onClick={onClose}>Apply Filters</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
