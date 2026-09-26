import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface PublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPublishing: boolean;
}

export function PublishConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPublishing,
}: PublishConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Job Publication</DialogTitle>
          <DialogDescription>
            This job will become visible to applicants immediately. Make sure all
            details are correct before proceeding.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPublishing}
            className="gap-2"
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Confirm & Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
