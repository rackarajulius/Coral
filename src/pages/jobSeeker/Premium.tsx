import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Crown, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { cn } from "@/lib/utils";
import {
  cancelPremium,
  formatPrice,
  premiumSummary,
  getMySubscription,
  getPremiumPlans,
  keepPremium,
  openBillingPortal,
  syncPremium,
  startPremiumCheckout,
  type BillingInterval,
} from "@/lib/api/premium";
import { CancelPremiumDialog } from "@/components/premium/CancelPremiumDialog";

const RETURN_PATH = "/premium";

/**
 * Premium for job seekers.
 *
 * Everything on this page is read from the server: prices come from Stripe,
 * and the comparison table from the same registry that meters usage. Nothing
 * is typed in here, so the page cannot advertise a price or a limit that isn't
 * the real one. Before Stripe prices exist it says Premium isn't on sale yet.
 *
 * Readable signed out, because this is where Premium is explained: the plans
 * route is public, the subscription one isn't asked for without a session, and
 * upgrading opens sign-in first and resumes checkout afterwards.
 */
export default function Premium() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const checkoutResult = params.get("checkout");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [busy, setBusy] = useState(false);

  const plans = useQuery({ queryKey: ["premium-plans"], queryFn: getPremiumPlans, retry: false });

  /**
   * Coming back from Stripe, Premium isn't granted yet — that happens when the
   * webhook arrives, a moment later and not in a guaranteed order. So the page
   * says "confirming" and checks every two seconds for up to a minute, rather
   * than announcing a Premium that doesn't exist yet.
   */
  const confirming = checkoutResult === "success";
  const sub = useQuery({
    queryKey: ["my-subscription"],
    queryFn: getMySubscription,
    // Nobody's subscription to ask about while signed out.
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: (q) => (confirming && q.state.data?.tier !== "premium" ? 2000 : false),
  });
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setGaveUp(true), 60_000);
    return () => clearTimeout(t);
  }, [confirming]);

  /**
   * And asks the server to check with Stripe straight away, rather than only
   * wait for Stripe's webhook to reach it. Once on arrival; the button below
   * asks again if Premium still isn't on.
   */
  const confirm = useMutation({
    mutationFn: syncPremium,
    onSuccess: (next) => queryClient.setQueryData(["my-subscription"], next),
  });
  const confirmOnce = confirm.mutate;
  useEffect(() => {
    if (confirming && isAuthenticated) confirmOnce();
  }, [confirming, isAuthenticated, confirmOnce]);

  const isPremium = sub.data?.tier === "premium";

  useEffect(() => {
    if (confirming && isPremium) {
      toast.success("Premium is active");
      // Allowances and the matcher both depend on the tier.
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      void queryClient.invalidateQueries({ queryKey: ["resume-matcher"] });
      const next = new URLSearchParams(params);
      next.delete("checkout");
      setParams(next, { replace: true });
    }
  }, [confirming, isPremium, params, setParams, queryClient]);

  // Offer only intervals that actually have a price; default to the first.
  const intervals = plans.data?.prices.map((p) => p.interval) ?? [];
  const chosen =
    plans.data?.prices.find((p) => p.interval === billingInterval) ?? plans.data?.prices[0];

  /**
   * Signed out, this opens sign-in and starts checkout once that succeeds,
   * rather than failing the request with an authentication error.
   */
  const upgrade = () => {
    if (!chosen) return;
    requireAuth(async () => {
      setBusy(true);
      try {
        await startPremiumCheckout(chosen.interval, RETURN_PATH);
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(false);
      }
    });
  };

  const [cancelling, setCancelling] = useState(false);
  const changed = (next: Awaited<ReturnType<typeof keepPremium>>) => {
    queryClient.setQueryData(["my-subscription"], next);
    void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
  };
  /** Changing one's mind before the date: Premium renews as before. */
  const keep = useMutation({
    mutationFn: keepPremium,
    onSuccess: (next) => {
      changed(next);
      toast.success("Premium will carry on", {
        description: next.currentPeriodEnd
          ? `It renews on ${new Date(next.currentPeriodEnd).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`
          : undefined,
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  /** An unpaid subscription has no period left to run out; this ends it now. */
  const endUnpaid = useMutation({
    mutationFn: () => cancelPremium(),
    onSuccess: (next) => {
      changed(next);
      toast.success("Your subscription has ended", { description: "Nothing more will be charged." });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const ending = !!sub.data?.paid && sub.data.cancelAtPeriodEnd;

  const manage = async () => {
    setBusy(true);
    try {
      await openBillingPortal(RETURN_PATH);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-24">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-coral/10 px-3 py-1 text-xs font-medium text-coral">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Premium
          </div>
          <h1 className="text-2xl font-bold text-foreground">More practice, and jobs from across the web</h1>
          <p className="mt-1 text-muted-foreground">
            The free plan includes real AI interview practice and matching against every job posted
            here. Premium adds more practice and looks beyond this site.
          </p>
        </div>

        {checkoutResult === "cancelled" && (
          <Notice tone="neutral">Checkout was cancelled. Nothing was charged.</Notice>
        )}
        {confirming && !isPremium && (
          <Notice tone="neutral">
            {gaveUp ? (
              <>
                <p>
                  Payment went through, but Premium hasn't switched on yet. It usually takes seconds. If
                  checking again doesn't help, contact support; you won't be charged twice.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => confirm.mutate()}
                  disabled={confirm.isPending}
                >
                  {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Check again
                </Button>
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Confirming your payment with Stripe…
              </span>
            )}
          </Notice>
        )}

        {sub.data && sub.data.status === "PAST_DUE" && sub.data.paid && (
          <Notice tone="warn">
            Your last payment didn't go through. Premium stays on while Stripe retries — update your
            card in Manage billing to keep it.
          </Notice>
        )}
        {/* Stripe has stopped retrying but kept the subscription: Premium is off
            until the open invoice is paid, or it can be ended for good. */}
        {sub.data && sub.data.status === "PAST_DUE" && !sub.data.paid && (
          <Notice tone="warn">
            <p>
              Your payment didn't go through and Stripe has stopped retrying, so Premium is off for now.
              Pay the open invoice in Manage billing to turn it back on.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sub.data.hasBillingAccount && (
                <Button size="sm" variant="outline" onClick={manage} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => endUnpaid.mutate()} disabled={endUnpaid.isPending}>
                {endUnpaid.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                End my subscription
              </Button>
            </div>
          </Notice>
        )}

        {isPremium && sub.data && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <p className="font-medium text-foreground">You're on Premium</p>
              <p className="text-sm text-muted-foreground">
                {premiumSummary(sub.data).join(" · ") || "Active"}
              </p>
              {sub.data.compedUntil && !sub.data.paid && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Given to you by the team — no payment needed. When it ends you'll be back on Free,
                  and you can subscribe here to keep Premium.
                </p>
              )}
              {ending && (
                <p className="mt-1 text-sm text-muted-foreground">
                  You've cancelled, so you won't be charged again. Everything stays on until then.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ending && (
                <Button variant="coral" onClick={() => keep.mutate()} disabled={keep.isPending}>
                  {keep.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Keep Premium
                </Button>
              )}
              {sub.data.hasBillingAccount && (
                <Button variant="outline" onClick={manage} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
                </Button>
              )}
              {sub.data.paid && !ending && (
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setCancelling(true)}>
                  Cancel Premium
                </Button>
              )}
            </div>
          </div>
        )}
        {sub.data?.paid && (
          <CancelPremiumDialog open={cancelling} onOpenChange={setCancelling} subscription={sub.data} plans={plans.data} />
        )}

        {plans.isLoading && <Skeleton className="h-80 rounded-2xl" />}

        {plans.isError && (
          <Notice tone="warn">Couldn't load Premium details. {(plans.error as Error).message}</Notice>
        )}

        {plans.data && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_auto] items-end gap-x-6 border-b border-border px-5 py-4 sm:gap-x-10">
              <span />
              <span className="w-20 text-center text-sm font-semibold text-foreground sm:w-28">Free</span>
              <span className="w-20 text-center text-sm font-semibold text-coral sm:w-28">Premium</span>
            </div>

            <ComparisonRow label="Matching with jobs posted here" free="Unlimited" premium="Unlimited" />
            <ComparisonRow label="See who viewed your profile" free={<Check className="mx-auto h-4 w-4" />} premium={<Check className="mx-auto h-4 w-4" />} />
            {plans.data.tiers.map((t) => (
              <ComparisonRow
                key={t.metric}
                label={t.label}
                free={limitText(t.free, t.window)}
                premium={t.live ? limitText(t.premium, t.window) : "Coming soon"}
                muted={!t.live}
              />
            ))}

            <div className="flex flex-col gap-4 border-t border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              {plans.data.available && chosen ? (
                <div>
                  {intervals.length > 1 && (
                    <div className="mb-2 inline-flex rounded-lg border border-border p-0.5" role="tablist">
                      {intervals.map((i) => (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={chosen.interval === i}
                          onClick={() => setBillingInterval(i)}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs transition-colors",
                            chosen.interval === i ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {i === "MONTHLY" ? "Monthly" : "Yearly"}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(chosen.unitAmount, chosen.currency)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}/ {chosen.interval === "YEARLY" ? "year" : "month"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid securely through Stripe. Cancel any time, right here — Premium stays until the period ends.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Premium isn't on sale yet. Everything in the free plan is available now.
                </p>
              )}

              {!isPremium && (
                <Button
                  variant="coral"
                  size="lg"
                  onClick={upgrade}
                  disabled={busy || !plans.data.available || confirming}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Premium"}
                </Button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/** "2 / month", "Unlimited", or a dash for "not on this plan". */
function limitText(limit: number | null, window: "day" | "month") {
  if (limit === null) return "Unlimited";
  if (limit === 0) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />;
  return `${limit} / ${window}`;
}

function ComparisonRow({
  label,
  free,
  premium,
  muted,
}: {
  label: string;
  free: React.ReactNode;
  premium: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-5 py-3 text-sm last:border-b-0 sm:gap-x-10">
      <span className="text-foreground">{label}</span>
      <span className="w-20 text-center text-muted-foreground sm:w-28">{free}</span>
      <span className={cn("w-20 text-center sm:w-28", muted ? "text-muted-foreground" : "font-medium text-foreground")}>
        {premium}
      </span>
    </div>
  );
}

function Notice({ tone, children }: { tone: "neutral" | "warn"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mb-6 flex items-start gap-2 rounded-2xl border p-4 text-sm",
        tone === "warn"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-border bg-card text-foreground",
      )}
    >
      {tone === "warn" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}
