import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Gift, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  type AdminJobseekerPremium,
  getJobseekerPremium,
  grantJobseekerPremium,
  revokeJobseekerPremium,
} from "@/lib/api/adminJobseekers";
// Comp dates are whole UTC days, shown the same way everywhere so the date here
// matches the one in the email the person receives.
import { formatCompDate as showDay } from "@/lib/api/premium";

const DAY = 24 * 60 * 60 * 1000;
/** One day under the server's 366-day cap, so the last selectable day always passes. */
const MAX_DAYS_AHEAD = 365;
const REASON_MIN = 3;
const REASON_MAX = 300;

/** "YYYY-MM-DD" for the UTC day `days` from today. */
function utcDay(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 91 },
  { label: "1 year", days: MAX_DAYS_AHEAD },
];

function paidSummary(paid: AdminJobseekerPremium["paid"]): string {
  if (!paid.active) {
    if (paid.status === "ACTIVE" || paid.status === "TRIALING") {
      // Fails closed on purpose: a price the app doesn't recognise never grants Premium.
      return "Stripe subscription on a price this app doesn't recognise — not counted as Premium";
    }
    return paid.status === "CANCELED" ? "No paid plan (a past subscription ended)" : "No paid plan";
  }
  const plan = paid.interval === "YEARLY" ? "Yearly" : "Monthly";
  const end = paid.currentPeriodEnd ? new Date(paid.currentPeriodEnd).toLocaleDateString() : null;
  if (paid.status === "PAST_DUE") return `${plan} — payment failed, Stripe is retrying`;
  if (paid.cancelAtPeriodEnd) return end ? `${plan} — cancelled, ends ${end}` : `${plan} — cancelled`;
  if (paid.status === "TRIALING") return end ? `${plan} — trial until ${end}` : `${plan} — on trial`;
  return end ? `${plan} — renews ${end}` : plan;
}

/**
 * Premium for one job seeker: whether they pay, whether they're comped, and
 * the controls to give or end a comp. Payment is never changed from here —
 * that stays with Stripe and the person.
 */
export function JobseekerPremiumPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const key = ["admin", "jobseekers", "premium", userId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => getJobseekerPremium(userId),
  });

  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const settle = (next: AdminJobseekerPremium) => {
    queryClient.setQueryData(key, next);
    // The table's Premium badge and the Premium Users count read the same tier.
    void queryClient.invalidateQueries({ queryKey: ["admin", "jobseekers", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "jobseekers", "metrics"] });
  };

  const grant = useMutation({
    // End of the chosen UTC day: "until 17 October" includes 17 October.
    mutationFn: () => grantJobseekerPremium(userId, new Date(`${until}T23:59:59.000Z`), reason.trim()),
    onSuccess: (next) => {
      settle(next);
      toast.success(`Premium given until ${showDay(next.comp.until!)}. They've been told.`);
      setUntil("");
      setReason("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void refetch();
    },
  });

  const revoke = useMutation({
    mutationFn: () => revokeJobseekerPremium(userId),
    onSuccess: (next) => {
      settle(next);
      setConfirmRevoke(false);
      toast.success(
        next.tier === "premium"
          ? "Comp ended. Their paid plan keeps Premium on."
          : "Comp ended. They're back on Free and have been told.",
      );
    },
    onError: (e: Error) => {
      setConfirmRevoke(false);
      toast.error(e.message);
      // Most often the comp already ran out; show what is true now.
      void refetch();
    },
  });

  const min = utcDay(1);
  const max = utcDay(MAX_DAYS_AHEAD);
  const dateOk = !!until && until >= min && until <= max;
  const reasonLength = reason.trim().length;
  const reasonOk = reasonLength >= REASON_MIN && reasonLength <= REASON_MAX;
  const busy = grant.isPending || revoke.isPending;

  return (
    <section className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Premium</h3>
        {data && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              data.tier === "premium"
                ? "bg-status-pending-bg text-status-pending"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {data.tier === "premium" && <Crown className="h-3 w-3" aria-hidden="true" />}
            {data.tier === "premium" ? "Premium" : "Free"}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError || !data ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          Couldn't load Premium details.
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0">
                <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Paid plan</span>
              </dt>
              <dd className="text-foreground">{paidSummary(data.paid)}</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0">
                <Gift className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Complimentary Premium</span>
              </dt>
              <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
                {data.comp.active && data.comp.until ? (
                  <div className="min-w-0">
                    <p className="text-foreground">Complimentary until {showDay(data.comp.until)}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {data.comp.reason && <>“{data.comp.reason}”</>}
                      {data.comp.grantedBy && <> · given by {data.comp.grantedBy}</>}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No complimentary Premium</p>
                )}
                {data.comp.active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={busy}
                    onClick={() => setConfirmRevoke(true)}
                  >
                    End now
                  </Button>
                )}
              </dd>
            </div>
          </dl>

          <form
            className="space-y-3 rounded-lg border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (dateOk && reasonOk && !busy) grant.mutate();
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {data.comp.active ? "Change the end date" : "Give Premium without payment"}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor={`comp-until-${userId}`} className="text-xs">
                Until (end of day, UTC)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`comp-until-${userId}`}
                  type="date"
                  min={min}
                  max={max}
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="h-8 w-auto text-sm"
                />
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setUntil(utcDay(p.days))}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              {until && !dateOk && (
                <p className="text-xs text-destructive">Pick a date between tomorrow and a year from today.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`comp-reason-${userId}`} className="text-xs">
                Reason (kept in the audit log)
              </Label>
              <Textarea
                id={`comp-reason-${userId}`}
                value={reason}
                maxLength={REASON_MAX}
                rows={2}
                placeholder="e.g. Beta tester, support goodwill after an outage"
                onChange={(e) => setReason(e.target.value)}
                className="text-sm"
              />
            </div>

            {data.paid.active && (
              <p className="text-xs text-muted-foreground">
                They already pay. A comp doesn't pause or refund their plan — Stripe keeps billing them.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {data.comp.active
                ? "The new date replaces the current one. They'll get an email and an in-app notice."
                : "They'll get an email and an in-app notice. Premium ends on its own on that date."}
            </p>

            <Button type="submit" size="sm" disabled={!dateOk || !reasonOk || busy}>
              {grant.isPending
                ? "Saving…"
                : dateOk
                  ? `${data.comp.active ? "Change to" : "Give Premium until"} ${showDay(`${until}T00:00:00.000Z`)}`
                  : data.comp.active
                    ? "Change end date"
                    : "Give Premium"}
            </Button>
          </form>
        </div>
      )}

      <AlertDialog open={confirmRevoke} onOpenChange={(open) => !open && !revoke.isPending && setConfirmRevoke(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End complimentary Premium now?</AlertDialogTitle>
            <AlertDialogDescription>
              {data?.paid.active
                ? "Their paid plan keeps Premium on, so nothing changes for them beyond the comp ending."
                : "They go back to Free straight away and get an email saying so."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={(e) => {
                e.preventDefault();
                revoke.mutate();
              }}
            >
              {revoke.isPending ? "Ending…" : "End comp"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default JobseekerPremiumPanel;
