import { X } from "lucide-react";
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

interface JobseekerFilterPanelProps {
  open: boolean;
  onClose: () => void;
}

const statuses = ["Active", "Inactive", "Suspended", "Flagged", "Deleted"];

export function JobseekerFilterPanel({ open, onClose }: JobseekerFilterPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
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
          {/* Status */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <div className="space-y-2">
              {statuses.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox id={`status-${s}`} />
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
              Signup Date Range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Last Active Range */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Last Active Range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Applications Count */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Applications Count
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input type="number" placeholder="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input type="number" placeholder="100" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Country */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Country
            </Label>
            <Input placeholder="Search country…" className="h-9 text-sm" />
          </div>

          <Separator />

          {/* Profile Completion */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile Completion (%)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input type="number" placeholder="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input type="number" placeholder="100" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Premium Only</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Flagged Only</Label>
              <Switch />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-6 py-4">
          <Button size="sm" variant="outline" className="flex-1" onClick={onClose}>
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={onClose}
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
