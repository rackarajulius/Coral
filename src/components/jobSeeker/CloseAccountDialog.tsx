import { useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface CloseAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement>;
}

export function CloseAccountDialog({ open, onOpenChange, returnFocusRef }: CloseAccountDialogProps) {
  const { closeAccount } = useAuth();
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closingRef = useRef(false);

  const confirm = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setError(null);
    try {
      const result = await closeAccount();
      onOpenChange(false);
      if (result.cleanupPending) toast.error(result.message || "Your account is closed, but data cleanup needs support.");
      else toast.success("Your account has been closed.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close your account. Please try again.");
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (closingRef.current) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%_-_2rem)] max-w-[480px] gap-0 overflow-hidden rounded-lg border-border bg-background p-0"
        onEscapeKeyDown={(event) => { if (closingRef.current) event.preventDefault(); }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        aria-busy={closing}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <AlertDialogTitle className="text-sm font-semibold">Close Account</AlertDialogTitle>
          <AlertDialogCancel asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mt-0 h-7 w-7 border-0 bg-transparent text-muted-foreground shadow-none"
              disabled={closing}
              aria-label="Cancel account closure"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </AlertDialogCancel>
        </div>
        <div className="space-y-3 px-4 py-5">
          <AlertDialogDescription className="text-sm leading-6">
            Are you sure you want to close your account? Your profile and job activity will be
            permanently deleted, any active Premium subscription will end, and you will be signed out.
            This cannot be undone.
          </AlertDialogDescription>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-4">
          <AlertDialogCancel asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-0 h-8 border-0 bg-transparent px-3 text-xs text-muted-foreground shadow-none"
              disabled={closing}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 bg-red-600 px-3 text-xs text-white hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-400 dark:text-gray-950 dark:hover:bg-red-500"
            disabled={closing}
            onClick={() => void confirm()}
          >
            {closing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {closing ? "Closing…" : "Close Account"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
