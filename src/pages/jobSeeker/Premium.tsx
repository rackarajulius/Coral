import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Crown, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatPrice,
  premiumSummary,
  getMySubscription,
  getPremiumPlans,
  openBillingPortal,
  startPremiumCheckout,
  type BillingInterval,
} from "@/lib/api/premium";

const RETURN_PATH = "/premium";

/**
 * Premium for job seekers.
 *
 * Everything on this page is read from the server: prices come from Stripe,
 * and the comparison table from the same registry that meters usage. Nothing
 * is typed in here, so the page cannot advertise a price or a limit that isn't
 * the real one. Before Stripe prices exist it says Premium isn't on sale yet.
 */
export default function Premium() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
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
    retry: false,
    refetchInterval: (q) => (confirming && q.state.data?.tier !== "premium" ? 2000 : false),
  });
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setGaveUp(true), 60_000);
    return () => clearTimeout(t);
  }, [confirming]);

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

  const upgrade = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await startPremiumCheckout(chosen.interval, RETURN_PATH);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

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
                Payment went through, but Premium hasn't switched on yet. It usually takes seconds —
                refresh in a minute, and if it still says Free, contact support; you won't be charged twice.
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Confirming your payment with Stripe…
              </span>
            )}
          </Notice>
        )}

        {sub.data && sub.data.status === "PAST_DUE" && (
          <Notice tone="warn">
            Your last payment didn't go through. Premium stays on while Stripe retries — update your
            card in Manage billing to keep it.
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
            </div>
            {sub.data.hasBillingAccount && (
              <Button variant="outline" onClick={manage} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
              </Button>
            )}
          </div>
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
                    Paid securely through Stripe. Cancel any time — Premium stays until the period ends.
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
