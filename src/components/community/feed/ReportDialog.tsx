import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getReportReasons, reportComment, reportPost } from "@/lib/api/community";

/** Server keys turned into something readable. Unknown keys pass through. */
const LABELS: Record<string, string> = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  misinformation: "Misleading or false",
  off_topic: "Off topic for this space",
  personal_information: "Shares someone's private information",
  other: "Something else",
};

/**
 * Flags a post or comment for a moderator.
 *
 * The reason list comes from the server rather than this file, so the options
 * offered are exactly the ones that will be accepted — a list maintained in two
 * places drifts, and the drift shows up as a rejected report.
 */
export function ReportDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: { kind: "post" | "comment"; id: string };
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");

  const reasons = useQuery({
    queryKey: ["report-reasons"],
    queryFn: getReportReasons,
    enabled: open,
    staleTime: Infinity,
  });

  const send = useMutation({
    mutationFn: () =>
      target.kind === "post"
        ? reportPost(target.id, reason!, detail.trim() || undefined)
        : reportComment(target.id, reason!, detail.trim() || undefined),
    onSuccess: () => {
      // No claim about what happens next: a report is a message to a person,
      // and promising an outcome we do not control would be the wrong promise.
      toast.success("Reported", { description: "A moderator will look at this." });
      setReason(null);
      setDetail("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Report this {target.kind}</DialogTitle>
          <DialogDescription>
            Only moderators see reports. The author is not told who reported them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            {reasons.data?.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setReason(key)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  reason === key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                {LABELS[key] ?? key}
              </button>
            ))}
          </div>

          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Anything that would help (optional)"
            rows={3}
            maxLength={1000}
            className="resize-none text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={!reason || send.isPending}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReportDialog;
