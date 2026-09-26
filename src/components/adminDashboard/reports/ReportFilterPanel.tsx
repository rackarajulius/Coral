import { ReportSeverity, ReportStatus, ReportType } from "@/data/admin/reports/reports";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

export interface ReportFilters {
  statuses: ReportStatus[];
  severities: ReportSeverity[];
  types: ReportType[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
}

const allStatuses: ReportStatus[] = ["Open", "In Review", "Escalated", "Resolved", "Dismissed"];
const allSeverities: ReportSeverity[] = ["Low", "Medium", "High"];
const allTypes: ReportType[] = ["Spam", "Fraud", "Harassment", "Fake Listing", "Discrimination", "Scam", "Inappropriate Content", "Identity Theft"];

export function ReportFilterPanel({ open, onClose, filters, onFiltersChange }: Props) {
  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const reset = () => onFiltersChange({ statuses: [], severities: [], types: [] });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Status</Label>
            <div className="space-y-2">
              {allStatuses.map(s => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox id={`rs-${s}`} checked={filters.statuses.includes(s)} onCheckedChange={() => onFiltersChange({ ...filters, statuses: toggle(filters.statuses, s) })} />
                  <label htmlFor={`rs-${s}`} className="text-sm text-card-foreground cursor-pointer">{s}</label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Severity</Label>
            <div className="space-y-2">
              {allSeverities.map(s => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox id={`rsev-${s}`} checked={filters.severities.includes(s)} onCheckedChange={() => onFiltersChange({ ...filters, severities: toggle(filters.severities, s) })} />
                  <label htmlFor={`rsev-${s}`} className="text-sm text-card-foreground cursor-pointer">{s}</label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Report Type</Label>
            <div className="space-y-2">
              {allTypes.map(t => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox id={`rt-${t}`} checked={filters.types.includes(t)} onCheckedChange={() => onFiltersChange({ ...filters, types: toggle(filters.types, t) })} />
                  <label htmlFor={`rt-${t}`} className="text-sm text-card-foreground cursor-pointer">{t}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={reset}>Reset</Button>
          <Button variant="default" size="sm" className="flex-1 " onClick={onClose}>Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
