import { useState } from "react";
import { ShieldOff, ShieldCheck, Trash2, Bell, Ban, X } from "lucide-react";
import { toastWithUndo } from "@/lib/toast-Undo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmModal, ConfirmModalVariant } from "@/components/ui/ConfirmModal";

interface JobseekerBulkActionBarProps {
  count: number;
  onClear: () => void;
  onActivate?: () => void;
  onSuspend?: () => void;
  onBan?: () => void;
  onDelete?: () => void;
}

export function JobseekerBulkActionBar({ count, onClear, onActivate, onSuspend, onBan, onDelete }: JobseekerBulkActionBarProps) {
  const [modal, setModal] = useState<ConfirmModalVariant | null>(null);

  if (count === 0) return null;

  const handleConfirm = () => {
    if (modal === "suspend") onSuspend?.();
    else if (modal === "ban") onBan?.();
    else if (modal === "delete") onDelete?.();
    setModal(null);
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-card",
          "animate-in slide-in-from-top-2 duration-150"
        )}
      >
        <span className="text-sm font-medium text-foreground">
          {count} jobseeker{count !== 1 ? "s" : ""} selected
        </span>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onActivate?.()}>
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-status-active" />
          Activate
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setModal("suspend")}>
          <ShieldOff className="mr-1.5 h-3.5 w-3.5 text-status-pending" />
          Suspend
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setModal("ban")}>
          <Ban className="mr-1.5 h-3.5 w-3.5 text-status-flagged" />
          Ban
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toastWithUndo(`Notification sent to ${count} jobseeker${count !== 1 ? "s" : ""}`, () => console.log("Undo: bulk notification"))}>
          <Bell className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          Send Notification
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs text-destructive hover:text-destructive"
          onClick={() => setModal("delete")}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {modal && (
        <ConfirmModal
          open={!!modal}
          variant={modal}
          targetName={`${count} jobseeker${count !== 1 ? "s" : ""}`}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  );
}
