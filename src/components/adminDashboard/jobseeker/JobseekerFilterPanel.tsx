import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countryName, getJobseekerCountries } from "@/lib/api/adminJobseekers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JOBSEEKER_STATUSES, type JobseekerStatus } from "@/data/admin/jobseeker/jobs-data";
import { defaultJobseekerFilters, type JobseekerFilters } from "@/hooks/admin/useAdminJobseekers";

/** Radix Select can't use "" as a value, so "any" needs a sentinel. */
const ANY = "__any";

interface JobseekerFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: JobseekerFilters;
  onApply: (filters: JobseekerFilters) => void;
}

/**
 * Filters the server applies. Changes are drafted here and take effect on
 * Apply, so a half-typed date doesn't refetch the list on every keystroke.
 *
 * There used to be profile-completion and application-count ranges too. They
 * did nothing — this panel held no state — and they are not offered now:
 * completion is computed in code and counts need raw SQL to filter on.
 */
export function JobseekerFilterPanel({ open, onClose, filters, onApply }: JobseekerFilterPanelProps) {
  const [draft, setDraft] = useState<JobseekerFilters>(filters);
  const countries = useQuery({
    queryKey: ["admin", "jobseekers", "countries"],
    queryFn: getJobseekerCountries,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Start from what is applied each time the panel opens.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const set = <K extends keyof JobseekerFilters>(key: K, value: JobseekerFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleStatus = (s: JobseekerStatus) =>
    set("statuses", draft.statuses.includes(s) ? draft.statuses.filter((x) => x !== s) : [...draft.statuses, s]);

  const apply = (next: JobseekerFilters) => {
    onApply(next);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Filters</SheetTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-5">
          {/* Reports — the replacement for the old risk filter */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="filter-open-reports" className="text-sm text-foreground">Has open reports</Label>
              <p className="text-xs text-muted-foreground">Something they wrote is waiting in Reports &amp; Flags.</p>
            </div>
            <Switch
              id="filter-open-reports"
              checked={draft.hasOpenReports}
              onCheckedChange={(v) => set("hasOpenReports", v)}
            />
          </div>

          <Separator />

          {/* Status */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account status
            </Label>
            <div className="space-y-2">
              {JOBSEEKER_STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${s}`}
                    checked={draft.statuses.includes(s)}
                    onCheckedChange={() => toggleStatus(s)}
                  />
                  <label htmlFor={`status-${s}`} className="text-sm text-foreground cursor-pointer">
                    {s}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Signup Date Range */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Signed up
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-9 text-sm" value={draft.signedUpFrom} onChange={(e) => set("signedUpFrom", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-9 text-sm" value={draft.signedUpTo} onChange={(e) => set("signedUpTo", e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Last Active Range */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Last active
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-9 text-sm" value={draft.activeFrom} onChange={(e) => set("activeFrom", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-9 text-sm" value={draft.activeTo} onChange={(e) => set("activeTo", e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Country — only countries someone has, so every choice matches. */}
          <div className="space-y-3">
            <Label htmlFor="filter-country" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Country
            </Label>
            <Select value={draft.country || ANY} onValueChange={(v) => set("country", v === ANY ? "" : v)}>
              <SelectTrigger id="filter-country" className="h-9 text-sm">
                <SelectValue placeholder="Any country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any country</SelectItem>
                {(countries.data ?? []).map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {countryName(c.code)} ({c.people})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {countries.isError && (
              <p className="text-xs text-destructive">Couldn't load the countries.</p>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="filter-premium" className="text-sm text-foreground">Premium only</Label>
            <Switch id="filter-premium" checked={draft.premiumOnly} onCheckedChange={(v) => set("premiumOnly", v)} />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-6 py-4">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => apply(defaultJobseekerFilters)}>
            Reset
          </Button>
          <Button variant="default" size="sm" className="flex-1" onClick={() => apply(draft)}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
