import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { SuppressionWindow, AlertRule } from "@/data/admin/alerts/types";

interface SuppressionWindowPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  window: SuppressionWindow | null;
  rules: AlertRule[];
  onSave: (window: SuppressionWindow) => void;
}

const RECURRENCE_PATTERNS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export function SuppressionWindowPanel({
  open,
  onOpenChange,
  window: editWindow,
  rules,
  onSave,
}: SuppressionWindowPanelProps) {
  const isEdit = !!editWindow;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [allRules, setAllRules] = useState(true);
  const [recurring, setRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("weekly");

  useEffect(() => {
    if (editWindow) {
      setName(editWindow.name);
      setDescription(editWindow.description);
      setStartTime(editWindow.startTime);
      setEndTime(editWindow.endTime);
      setSelectedRuleIds(editWindow.ruleIds);
      setAllRules(editWindow.ruleIds.length === 0);
      setRecurring(editWindow.recurring);
      setRecurrencePattern(editWindow.recurrencePattern || "weekly");
    } else {
      setName("");
      setDescription("");
      const now = new Date();
      const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setStartTime(now.toISOString().slice(0, 16));
      setEndTime(later.toISOString().slice(0, 16));
      setSelectedRuleIds([]);
      setAllRules(true);
      setRecurring(false);
      setRecurrencePattern("weekly");
    }
  }, [editWindow, open]);

  const toggleRule = (ruleId: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    );
  };

  const getStatus = (): SuppressionWindow["status"] => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now >= start && now <= end) return "active";
    if (now < start) return "scheduled";
    return "expired";
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Window name is required");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Start and end times are required");
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error("End time must be after start time");
      return;
    }
    if (!allRules && selectedRuleIds.length === 0) {
      toast.error("Select at least one rule or choose 'All Rules'");
      return;
    }

    const saved: SuppressionWindow = {
      id: editWindow?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      startTime,
      endTime,
      ruleIds: allRules ? [] : selectedRuleIds,
      status: getStatus(),
      recurring,
      recurrencePattern: recurring ? recurrencePattern : undefined,
      createdBy: editWindow?.createdBy || "Admin",
      createdAt: editWindow?.createdAt || new Date().toISOString(),
    };
    onSave(saved);
    onOpenChange(false);
    toast.success(isEdit ? "Suppression window updated" : "Suppression window created");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Suppression Window" : "Create Suppression Window"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modify the maintenance window configuration."
              : "Mute alerts during scheduled maintenance."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Basic Info</h4>
            <div className="space-y-2">
              <Label htmlFor="sw-name">Window Name</Label>
              <Input
                id="sw-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly DB Maintenance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-desc">Description (optional)</Label>
              <Textarea
                id="sw-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Reason for the maintenance window"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Schedule */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Schedule</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Recurring</p>
                <p className="text-xs text-muted-foreground">Repeat this window on a schedule.</p>
              </div>
              <Switch checked={recurring} onCheckedChange={setRecurring} />
            </div>

            {recurring && (
              <div className="space-y-2">
                <Label>Recurrence Pattern</Label>
                <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_PATTERNS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Rule Scope */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Affected Rules</h4>
            <p className="text-xs text-muted-foreground">Choose which alert rules to suppress during this window.</p>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={allRules} onCheckedChange={(checked) => setAllRules(!!checked)} />
              <span className="text-sm font-medium">All Rules</span>
            </label>

            {!allRules && (
              <div className="space-y-2 pl-1 max-h-48 overflow-y-auto">
                {rules.map((rule) => (
                  <label key={rule.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedRuleIds.includes(rule.id)}
                      onCheckedChange={() => toggleRule(rule.id)}
                    />
                    <span className="text-sm">{rule.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">({rule.severity})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Preview */}
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Alerts will be muted{" "}
              {startTime && endTime ? (
                <>
                  from <span className="font-medium text-foreground">{new Date(startTime).toLocaleString()}</span>{" "}
                  to <span className="font-medium text-foreground">{new Date(endTime).toLocaleString()}</span>
                </>
              ) : (
                "during the configured period"
              )}
              {" "}for{" "}
              <span className="font-medium text-foreground">
                {allRules ? "all rules" : `${selectedRuleIds.length} selected rule(s)`}
              </span>
              {recurring && (
                <>, repeating <span className="font-medium text-foreground">{recurrencePattern}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">
            {isEdit ? "Save Changes" : "Create Window"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
