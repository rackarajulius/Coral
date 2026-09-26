import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Play } from "lucide-react";
import type { AutomationTask } from "@/data/admin/automation/automation";

interface AutomationConfigPanelProps {
  task: AutomationTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (task: AutomationTask) => void;
}

const frequencies = [
  "Every 5 minutes",
  "Every 15 minutes",
  "Every hour",
  "Every 6 hours",
  "Every 12 hours",
  "Daily",
  "Weekly",
  "Monthly",
];

export function AutomationConfigPanel({
  task,
  open,
  onOpenChange,
  onUpdate,
}: AutomationConfigPanelProps) {
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  if (!task) return null;

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      setShowDisableConfirm(true);
    } else {
      onUpdate({ ...task, enabled: true, status: "active" });
    }
  };

  const confirmDisable = () => {
    onUpdate({ ...task, enabled: false, status: "paused" });
    setShowDisableConfirm(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{task.name}</SheetTitle>
            <SheetDescription>{task.description}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="task-enabled" className="text-sm font-medium">
                Enabled
              </Label>
              <Switch
                id="task-enabled"
                checked={task.enabled}
                onCheckedChange={handleToggle}
              />
            </div>

            <Separator />

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant={
                  task.status === "active"
                    ? "connected"
                    : task.status === "error"
                    ? "destructive"
                    : "disconnected"
                }
              >
                {task.status === "active"
                  ? "Active"
                  : task.status === "error"
                  ? "Error"
                  : "Paused"}
              </Badge>
            </div>

            {/* Last run result */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Run</span>
              <span className="text-sm text-foreground">{task.lastRun}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Next Run</span>
              <span className="text-sm text-foreground">{task.nextRun}</span>
            </div>

            <Separator />

            {/* Frequency */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Frequency</Label>
              <Select
                value={task.frequency}
                onValueChange={(v) => onUpdate({ ...task, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Parameters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Parameters</Label>
              {Object.entries(task.parameters).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </Label>
                  <Input
                    value={value}
                    onChange={(e) =>
                      onUpdate({
                        ...task,
                        parameters: { ...task.parameters, [key]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2">
                <Play className="h-4 w-4" />
                Run Now
              </Button>
              <Button variant="ghost" className="justify-start gap-2" asChild>
                <a href={task.logsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View Logs
                </a>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Disable confirmation modal */}
      <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {task.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will pause the automation task. It will no longer run on
              schedule until re-enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
