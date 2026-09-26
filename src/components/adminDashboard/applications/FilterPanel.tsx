import { ApplicationStatus } from "@/data/admin/applications/applications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: {
    statuses: ApplicationStatus[];
    flaggedOnly: boolean;
  };
  onFiltersChange: (filters: FilterPanelProps["filters"]) => void;
}

const allStatuses: ApplicationStatus[] = ["Submitted", "Under Review", "Shortlisted", "Interview", "Rejected", "Withdrawn", "Flagged"];

export function FilterPanel({ open, onClose, filters, onFiltersChange }: FilterPanelProps) {
  const toggleStatus = (status: ApplicationStatus) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: next });
  };

  const resetFilters = () => {
    onFiltersChange({ statuses: [], flaggedOnly: false });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold text-card-foreground mb-3 block">Status</Label>
            <div className="space-y-2">
              {allStatuses.map(status => (
                <div key={status} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.statuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <label htmlFor={`status-${status}`} className="text-sm text-card-foreground cursor-pointer">{status}</label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-card-foreground">Flagged Only</Label>
            <Switch
              checked={filters.flaggedOnly}
              onCheckedChange={(v) => onFiltersChange({ ...filters, flaggedOnly: v })}
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={resetFilters}>Reset</Button>
          <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={onClose}>Apply Filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
