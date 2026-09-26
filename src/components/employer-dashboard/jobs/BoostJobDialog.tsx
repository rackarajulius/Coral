import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startBoost, type BoostAllowance } from "@/lib/api/recommendations";

/**
 * Confirms a boost and says plainly what it buys.
 *
 * There is nothing to configure, on purpose: no audience, no location, no
 * seniority. A boost widens how far a job travels among people it already
 * matches; it never decides who they are.
 */
export default function BoostJobDialog({
  job,
  allowance,
  open,
  onOpenChange,
}: {
  job: { id: string; title: string } | null;
  allowance: BoostAllowance | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const limit = allowance?.limit ?? null;
  const used = allowance?.used ?? 0;
  const over = limit !== null && used >= limit;
  const blocked = over && !!allowance?.enforced;

  const confirm = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const result = await startBoost(job.id);
      toast.success(
        result.queued > 0
          ? `Boosted. ${result.queued} more matching ${result.queued === 1 ? "person" : "people"} will hear about it in their next daily digest.`
          : "Boosted. Nobody new matches yet — it's promoted to matching seekers as they arrive.",
      );
      void queryClient.invalidateQueries({ queryKey: ["recommendation-reach"] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-coral" /> Boost “{job?.title}”
          </DialogTitle>
          <DialogDescription>For 14 days, this job travels further among people it matches.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          <li>• Sent to up to 250 more job seekers whose skills and preferences match it.</li>
          <li>• If applications are slow after 3 days, a second wave reaches up to 150 more.</li>
          <li>• Shown at the top of matching seekers' “Picked for you”, labelled <em>Promoted</em>.</li>
        </ul>
        <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          You don't choose who sees it. The same matching rules decide for every job, paid or not, and a boost never
          sends anyone more than their one daily roundup.
        </p>

        <p className="text-xs text-muted-foreground">
          {limit === null
            ? `${used} boosts used this period · unlimited on your plan`
            : `${used} of ${limit} boosts used this period`}
          {over && !blocked && " · over your plan's allowance, allowed while billing limits aren't enforced"}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || blocked || !job}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {blocked ? "No boosts left" : "Boost for 14 days"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
