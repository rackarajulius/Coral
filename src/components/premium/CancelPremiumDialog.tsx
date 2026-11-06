import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CANCEL_REASONS, cancelPremium, formatCompDate,
  type CancelReason, type MySubscription, type PremiumPlans,
} from "@/lib/api/premium";

/** "1 December 2026". */
function longDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** "60 a month", "20 a day", or "not included". */
function allowance(limit: number | null, window: "day" | "month"): string {
  if (limit === null) return "unlimited";
  if (limit === 0) return "not included";
  return `${limit} a ${window}`;
}

/**
 * Cancelling Premium, in the app.
 *
 * Says exactly what happens and when, before anything does: Premium stays on
 * to the end of the period already paid for, nothing more is charged, and
 * here is what changes after. The reason is optional and goes to Stripe with
 * the cancellation. "Keep Premium" is the default button — leaving is one
 * deliberate click, never an accident.
 */
export function CancelPremiumDialog({
  open,
  onOpenChange,
  subscription,
  plans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: MySubscription;
  plans: PremiumPlans | undefined;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState("");
  const ends = longDate(subscription.currentPeriodEnd);

  const cancel = useMutation({
    mutationFn: () => cancelPremium({ ...(reason ? { reason } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}) }),
    onSuccess: (next) => {
      queryClient.setQueryData(["my-subscription"], next);
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      toast.success(next.currentPeriodEnd && next.cancelAtPeriodEnd
        ? `Premium will end on ${longDate(next.currentPeriodEnd)}`
        : "Your subscription has ended", {
        description: next.cancelAtPeriodEnd ? "You won't be charged again. You can keep Premium until then." : undefined,
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Only what actually changes: features both plans treat alike aren't news.
  const changes = (plans?.tiers ?? []).filter((t) => t.live && t.free !== t.premium);

  return (
    <Dialog open={open} onOpenChange={(next) => !cancel.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Cancel Premium?</DialogTitle>
          <DialogDescription>
            {ends
              ? `Premium stays on until ${ends}, and you won't be charged again. After that your account moves to the free plan.`
              : "You won't be charged again, and your account moves to the free plan when the current period ends."}{" "}
            Nothing you've made is deleted.
          </DialogDescription>
        </DialogHeader>

        {subscription.compedUntil && (
          <p className="rounded-xl bg-muted/60 p-3 text-sm">
            Your complimentary Premium carries on until {formatCompDate(subscription.compedUntil)}, whatever you decide here.
          </p>
        )}

        {changes.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">On the free plan</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {changes.map((t) => (
                <li key={t.metric} className="flex justify-between gap-3">
                  <span>{t.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {allowance(t.premium, t.window)} → <span className="text-foreground">{allowance(t.free, t.window)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">
            Why are you leaving? <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={reason === r.value}
                onClick={() => setReason(reason === r.value ? null : r.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  reason === r.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Anything else we should know?"
            aria-label="Anything else we should know?"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-foreground/30"
          />
        </fieldset>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending} autoFocus>
            Keep Premium
          </Button>
          <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancel Premium
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CancelPremiumDialog;
