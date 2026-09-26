import { useState } from "react";
import { AlertTriangle, Shield, Mail, Trash2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Report } from "@/data/admin/reports/reports";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DestructiveAction = "suspend" | "delete" | null;

const severityDot: Record<string, string> = {
  Low: "bg-slate-400",
  Medium: "bg-amber-500",
  High: "bg-rose-500",
};

const statusStyle: Record<string, string> = {
  Open:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  "In Review":
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
  Escalated:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  Resolved:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
  Dismissed:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

interface Props {
  report: Report | null;
  open: boolean;
  onClose: () => void;
  onAction?: (type: "suspend" | "delete" | "escalate" | "mark-safe", report: Report) => void;
}

export function ReportDetailPanel({ report, open, onClose, onAction }: Props) {
  const [pendingAction, setPendingAction] = useState<DestructiveAction>(null);

  if (!report) return null;

  const actionConfig = {
    suspend: {
      title: "Suspend this account?",
      description: `This will immediately suspend ${report.entity.name} (${report.entity.id}) and prevent all platform activity. This action can be reversed.`,
      confirm: "Suspend Account",
      onSuccess: "Account suspended",
    },
    delete: {
      title: "Delete this report?",
      description: `This will permanently remove report ${report.id} and all associated investigation data. This action cannot be undone.`,
      confirm: "Delete Report",
      onSuccess: "Report deleted",
    },
  };

  const handleConfirm = () => {
    if (pendingAction) {
      if (onAction) {
        onAction(pendingAction, report);
      } else {
        toast.success(actionConfig[pendingAction].onSuccess, {
          description: `${report.entity.name} — ${report.id}`,
        });
      }
      setPendingAction(null);
    }
  };

  const handleNonDestructive = (type: "escalate" | "mark-safe") => {
    if (onAction) {
      onAction(type, report);
    } else {
      const msg = type === "escalate" ? "Report escalated" : "Report marked as safe";
      toast.success(msg, { description: report.id });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-full max-w-[480px] sm:max-w-[480px] overflow-y-auto scrollbar p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
            <SheetHeader className="space-y-0.5">
              <SheetDescription className="text-xs font-medium">{report.id}</SheetDescription>
              <SheetTitle className="text-base font-semibold text-card-foreground">{report.type}</SheetTitle>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Section 1 — Summary */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Summary</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Type</p>
                  <p className="text-card-foreground font-medium">{report.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Severity</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", severityDot[report.severity])} />
                    <span className="text-card-foreground font-medium">{report.severity}</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusStyle[report.status])}>
                    {report.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Assigned To</p>
                  <p className="text-card-foreground font-medium">{report.assignedTo || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-card-foreground font-medium">{report.createdAt}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Updated</p>
                  <p className="text-card-foreground font-medium">{report.updatedAt}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 2 — Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <p className="text-sm text-card-foreground leading-relaxed">{report.description}</p>
            </div>

            <Separator />

            {/* Section 3 — Entity */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entity Details</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p className="text-card-foreground font-medium">{report.entity.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Type</p>
                  <p className="text-card-foreground font-medium">{report.entity.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ID</p>
                  <p className="text-card-foreground font-medium">{report.entity.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Reported By</p>
                  <p className="text-card-foreground font-medium">{report.reportedBy}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 4 — Risk Signals */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Signals</h3>
              <div className="space-y-1.5">
                {report.riskSignals.map((signal, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={cn("h-1.5 w-1.5 rounded-full", signal.active ? "bg-status-rejected" : "bg-muted-foreground/30")} />
                    <span className={cn(signal.active ? "text-card-foreground" : "text-muted-foreground")}>{signal.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Section 5 — Timeline */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity Timeline</h3>
              <div className="space-y-3">
                {report.timeline.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-border mt-1.5" />
                      {i < report.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm text-card-foreground">{event.event}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.date}{event.actor ? ` · ${event.actor}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Internal Notes */}
            {report.internalNotes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</h3>
                  <div className="space-y-2">
                    {report.internalNotes.map((note, i) => (
                      <div key={i} className="rounded-lg bg-secondary p-3">
                        <p className="text-sm text-card-foreground">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">{note.author} · {note.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Section 6 — Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => handleNonDestructive("mark-safe")}>
                  <Shield className="h-4 w-4" /> Mark Safe
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => handleNonDestructive("escalate")}>
                  <ArrowUpRight className="h-4 w-4" /> Escalate
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => toast.success("Warning sent", { description: `Warning email sent to ${report.entity.name}.` })}>
                  <Mail className="h-4 w-4" /> Send Warning
                </Button>

                <Separator />

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setPendingAction("suspend")}
                >
                  <AlertTriangle className="h-4 w-4" /> Suspend Account
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setPendingAction("delete")}
                >
                  <Trash2 className="h-4 w-4" /> Delete Report
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      {pendingAction && (
        <AlertDialog open={!!pendingAction} onOpenChange={v => { if (!v) setPendingAction(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionConfig[pendingAction].title}</AlertDialogTitle>
              <AlertDialogDescription>{actionConfig[pendingAction].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirm}
              >
                {actionConfig[pendingAction].confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
