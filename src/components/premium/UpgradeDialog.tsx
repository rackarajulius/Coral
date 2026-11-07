import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Crown, Loader2, Minus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { cn } from "@/lib/utils";
import { getPremiumPlans, startPremiumCheckout, type BillingInterval, type PremiumPlans } from "@/lib/api/premium";
import { allowanceText, formatPlanPrice, perMonth, yearlySaving, type PlanPrice } from "@/lib/premium/pricing";
import { useUpgradePrompt, type UpgradePrompt } from "@/stores/upgradePromptStore";

/** Stripe sends people back to the Premium page, which confirms the payment. */
const RETURN_PATH = "/premium";

/**
 * What someone sees when their plan doesn't cover what they just tried: the
 * plans side by side, with what each includes and what it costs.
 *
 * - **Not in your plan / used your free allowance** — the plan cards, with the
 *   feature that led here picked out, and when a free allowance comes back.
 * - **Premium, at the fair-use cap** — say when it comes back. No cards: there
 *   is nothing further to buy, and pitching one would be a lie.
 *
 * Prices and allowances come from the server (Stripe and the metering
 * registry), so the cards can't advertise anything that isn't real. A free
 * alternative, when the caller has one, is its own button: always a choice.
 */
export function UpgradeDialog() {
  const { prompt, close } = useUpgradePrompt();
  const premiumAtCap = prompt?.code === "ALLOWANCE_EXHAUSTED" && prompt.tier === "premium";

  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && close()}>
      {prompt &&
        (premiumAtCap ? <CapReached prompt={prompt} onClose={close} /> : <PlanCards prompt={prompt} onClose={close} />)}
    </Dialog>
  );
}

export default UpgradeDialog;

/** "1 November", or "Monday 27 October" for a daily allowance. */
function resetsOn(prompt: UpgradePrompt): string | null {
  if (!prompt.resetsAt) return null;
  return new Date(prompt.resetsAt).toLocaleDateString(undefined, {
    weekday: prompt.metric === "matcher.web" ? "long" : undefined,
    day: "numeric",
    month: "long",
  });
}

/** Runs the caller's free alternative after closing, so it opens on a clear screen. */
function AlternativeButton({ prompt, onClose }: { prompt: UpgradePrompt; onClose: () => void }) {
  if (!prompt.alternative) return null;
  const { label, run } = prompt.alternative;
  return (
    <Button
      variant="outline"
      onClick={() => {
        onClose();
        run();
      }}
    >
      {label}
    </Button>
  );
}

function CapReached({ prompt, onClose }: { prompt: UpgradePrompt; onClose: () => void }) {
  const resets = resetsOn(prompt);
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10 text-coral">
          <Crown className="h-5 w-5" aria-hidden="true" />
        </div>
        <DialogTitle>You've reached this period's limit</DialogTitle>
        <DialogDescription className="space-y-2">
          <span className="block">{prompt.message}</span>
          {resets && <span className="block">Your allowance comes back on {resets}.</span>}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2 sm:justify-end">
        <AlternativeButton prompt={prompt} onClose={onClose} />
        <Button onClick={onClose}>OK</Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface Feature {
  key: string;
  label: string;
  /** What the plan gives; null when it isn't included. */
  value: string | null;
  comingSoon?: boolean;
}

/** One list per plan, read from the same registry the server meters against. */
function featuresFor(plans: PremiumPlans, plan: "free" | "premium"): Feature[] {
  return [
    // Not metered on either plan: it's what the free plan is promised in full.
    { key: "platform", label: "Matching with jobs posted here", value: "Unlimited" },
    ...plans.tiers.map((t) => ({
      key: t.metric,
      label: t.label,
      value: plan === "free" ? allowanceText(t.free, t.window) : allowanceText(t.premium, t.window),
      // Never sold before it works.
      comingSoon: plan === "premium" && !t.live,
    })),
  ];
}

function PlanCards({ prompt, onClose }: { prompt: UpgradePrompt; onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const [busy, setBusy] = useState<BillingInterval | null>(null);
  const plans = useQuery({
    queryKey: ["premium-plans"],
    queryFn: getPremiumPlans,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const monthly = plans.data?.prices.find((p) => p.interval === "MONTHLY");
  const yearly = plans.data?.prices.find((p) => p.interval === "YEARLY");
  const onSale = !!plans.data?.available && !!(monthly || yearly);
  const currency = (monthly ?? yearly)?.currency ?? "usd";
  const saving = yearlySaving(monthly, yearly);
  const resets = resetsOn(prompt);

  /** Signed out, sign-in comes first and checkout starts once it succeeds. */
  const checkout = (interval: BillingInterval) => {
    const go = async () => {
      setBusy(interval);
      try {
        await startPremiumCheckout(interval, RETURN_PATH);
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(null);
      }
    };
    if (isAuthenticated) {
      void go();
    } else {
      // The sign-in window can't open over this one.
      onClose();
      requireAuth(() => void go());
    }
  };

  const title =
    prompt.code === "ALLOWANCE_EXHAUSTED" ? "You've used your free allowance" : "Get more from your job search";

  return (
    <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl p-5 sm:p-8">
      <DialogHeader className="items-center text-center sm:text-center">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1 text-xs font-medium text-coral-dark">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Premium
        </div>
        <DialogTitle className="text-2xl font-bold sm:text-3xl">{title}</DialogTitle>
        <DialogDescription className="max-w-xl text-center">
          {prompt.message && <span>{prompt.message} </span>}
          {resets ? (
            <span>Your free allowance comes back on {resets}, or upgrade to keep going now.</span>
          ) : (
            <span>Start with Free, upgrade when you need more. Cancel any time.</span>
          )}
        </DialogDescription>
      </DialogHeader>

      {plans.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : !plans.data ? (
        <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
          Couldn't load the plans just now.{" "}
          <Link to="/premium" onClick={onClose} className="font-medium text-coral hover:underline">
            See Premium
          </Link>
        </p>
      ) : (
        <div className={cn("grid gap-4", onSale && monthly && yearly ? "md:grid-cols-3" : "md:grid-cols-2")}>
          <PlanCard
            name="Free"
            blurb="Matching with jobs posted here, and a first taste of AI interview practice."
            price={formatPlanPrice(0, currency)}
            unit="forever"
            action={
              <Button variant="outline" className="w-full" disabled>
                {isAuthenticated ? "Your current plan" : "Free with an account"}
              </Button>
            }
            features={featuresFor(plans.data, "free")}
            highlight={prompt.metric}
          />

          {!onSale ? (
            <PlanCard
              featured
              name="Premium"
              blurb="Jobs from across the web, and AI help with every application."
              price="Soon"
              action={
                <Button variant="coral" className="w-full" disabled>
                  Not on sale yet
                </Button>
              }
              note="Everything in Free is available now."
              features={featuresFor(plans.data, "premium")}
              highlight={prompt.metric}
            />
          ) : (
            <>
              {monthly && (
                <PlanCard
                  featured
                  name="Premium"
                  blurb="Jobs from across the web, and AI help with every application."
                  price={formatPlanPrice(monthly.unitAmount, monthly.currency)}
                  unit="/ month"
                  action={<CheckoutButton price={monthly} busy={busy} onClick={checkout} label="Get Premium monthly" />}
                  note="Cancel any time."
                  features={featuresFor(plans.data, "premium")}
                  highlight={prompt.metric}
                />
              )}
              {yearly && (
                <PlanCard
                  featured={!monthly}
                  name={monthly ? "Premium yearly" : "Premium"}
                  badge={saving ? `Save ${saving}%` : undefined}
                  blurb={
                    monthly
                      ? "Everything in Premium, paid once a year."
                      : "Jobs from across the web, and AI help with every application."
                  }
                  price={formatPlanPrice(yearly.unitAmount, yearly.currency)}
                  unit="/ year"
                  sub={`${formatPlanPrice(perMonth(yearly), yearly.currency)} a month, billed yearly`}
                  action={<CheckoutButton price={yearly} busy={busy} onClick={checkout} label="Get Premium yearly" />}
                  note="Cancel any time."
                  features={
                    monthly
                      ? [
                          { key: "all", label: "Everything in Premium", value: "" },
                          ...(saving
                            ? [{ key: "saving", label: `${saving}% less than paying monthly`, value: "" }]
                            : []),
                          { key: "once", label: "One payment a year", value: "" },
                        ]
                      : featuresFor(plans.data, "premium")
                  }
                  highlight={prompt.metric}
                />
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Paid securely through Stripe. Premium stays until the end of the period you paid for.{" "}
          <Link to="/premium" onClick={onClose} className="font-medium text-coral hover:underline">
            Compare plans
          </Link>
        </p>
        <AlternativeButton prompt={prompt} onClose={onClose} />
      </div>
    </DialogContent>
  );
}

function CheckoutButton({
  price,
  busy,
  onClick,
  label,
}: {
  price: PlanPrice;
  busy: BillingInterval | null;
  onClick: (interval: BillingInterval) => void;
  label: string;
}) {
  return (
    <Button variant="coral" className="w-full" disabled={busy !== null} onClick={() => onClick(price.interval)}>
      {busy === price.interval ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Opening checkout" /> : label}
    </Button>
  );
}

function PlanCard({
  name,
  badge,
  blurb,
  price,
  unit,
  sub,
  action,
  note,
  features,
  highlight,
  featured,
}: {
  name: string;
  badge?: string;
  blurb: string;
  price: string;
  unit?: string;
  sub?: string;
  action: React.ReactNode;
  note?: string;
  features: Feature[];
  /** The feature that led here, picked out in the list. */
  highlight?: string;
  featured?: boolean;
}) {
  return (
    <section
      aria-label={name}
      className={cn(
        "flex flex-col rounded-2xl border p-5 text-left",
        featured
          ? "border-coral/40 bg-gradient-to-b from-coral/10 via-card to-card shadow-md shadow-coral/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        {badge && (
          <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-medium text-coral-dark">{badge}</span>
        )}
      </div>
      <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">{blurb}</p>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight text-foreground">{price}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1 min-h-[1rem] text-xs text-muted-foreground">{sub}</p>

      <div className="mt-4">{action}</div>
      {note && <p className="mt-2 text-center text-xs text-muted-foreground">{note}</p>}

      <ul className="mt-5 space-y-2 border-t border-border pt-4">
        {features.map((f) => {
          const included = f.value !== null && !f.comingSoon;
          return (
            <li
              key={f.key}
              className={cn(
                "flex items-start gap-2 rounded-md text-sm",
                f.key === highlight && "-mx-2 bg-coral/10 px-2 py-1",
              )}
            >
              {included ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
              ) : (
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              )}
              <span className={cn("min-w-0", included ? "text-foreground" : "text-muted-foreground")}>
                {f.label}
                {f.comingSoon ? (
                  <span className="text-muted-foreground"> · coming soon</span>
                ) : f.value ? (
                  <span className="text-muted-foreground"> · {f.value}</span>
                ) : f.value === null ? (
                  <span className="sr-only"> (not included)</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
