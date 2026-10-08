import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Building2, Check, ExternalLink, FileText, Info, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UNDERLINE_TABS_LIST, EMPLOYER_UNDERLINE_TAB_TRIGGER } from "@/lib/tabStyles";
import { UsageBar } from "@/components/employer-dashboard/billing/UsageBar";
import {
  amountFor,
  annualSaving,
  formatMoney,
  getBillingOverview,
  getInvoices,
  getPlanEntitlements,
  hasCompany,
  openBillingPortal,
  planRank,
  startCheckout,
  type BillingInterval,
  type BillingOverview,
  type Invoice,
  type PlanEntitlement,
  type PlanPrice,
  type SubscriptionStatus,
  type UsageLine,
} from "@/lib/api/billing";

/**
 * Plans & billing.
 *
 * Everything here is measured or absent. Where a figure is not yet known — a
 * card, an invoice, a renewal date for a company that never subscribed — the
 * page says so rather than showing a plausible one.
 */
export default function BillingPage() {
  const overview = useQuery({ queryKey: ["billing", "overview"], queryFn: getBillingOverview });
  useCheckoutReturn();
  const plans = useQuery({ queryKey: ["billing", "entitlements"], queryFn: getPlanEntitlements });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10 md:py-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Plans &amp; Billing
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground md:text-base">
            Your plan, and what your team has used against it.
          </p>
        </header>

        <Separator className="my-10" />

        {overview.isLoading && <LoadingState />}

        {overview.isError && (
          <Notice tone="error" icon={AlertTriangle} title="Couldn't load your billing">
            {(overview.error as Error).message}
          </Notice>
        )}

        {overview.data && !hasCompany(overview.data) && (
          <Notice tone="muted" icon={Building2} title="No company yet">
            {overview.data.reason}
          </Notice>
        )}

        {overview.data && hasCompany(overview.data) && (
          /**
           * Three tabs rather than one long scroll. Most visits are "when does
           * this renew" or "where is my invoice", and both used to sit below a
           * full plan comparison that only matters when you are changing plan.
           */
          <Tabs defaultValue="plans">
            <TabsList className={cn(UNDERLINE_TABS_LIST, "w-full")}>
              <TabsTrigger value="plans" className={EMPLOYER_UNDERLINE_TAB_TRIGGER}>Plan</TabsTrigger>
              <TabsTrigger value="usage" className={EMPLOYER_UNDERLINE_TAB_TRIGGER}>Usage</TabsTrigger>
              <TabsTrigger value="invoices" className={EMPLOYER_UNDERLINE_TAB_TRIGGER}>Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="mt-6 space-y-8">
              <PlanCard data={overview.data} />
              <PlanComparison
                plans={plans.data}
                loading={plans.isLoading}
                error={plans.isError}
                overview={overview.data}
              />
            </TabsContent>

            <TabsContent value="usage" className="mt-6">
              <UsageSection data={overview.data} />
            </TabsContent>

            <TabsContent value="invoices" className="mt-6">
              <PaymentSection overview={overview.data} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

/**
 * Handles the trip back from Stripe Checkout.
 *
 * The plan is granted by the webhook, not by this redirect, and the two race:
 * Stripe usually delivers the event within a second or two, but the browser
 * can arrive first. So this refetches on a short delay and says "confirming"
 * rather than "upgraded" — claiming success before the webhook lands would be
 * announcing something that has not happened yet.
 */
function useCheckoutReturn() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const upgraded = params.get("upgraded") === "1";

  useEffect(() => {
    if (!upgraded) return;

    toast.success("Payment received", {
      description: "Confirming your new plan — this usually takes a few seconds.",
    });

    // Clear the flag first so a refresh does not replay the toast.
    params.delete("upgraded");
    setParams(params, { replace: true });

    const timers = [1500, 5000, 12000].map((ms) =>
      window.setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: ["billing"] }),
        ms,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgraded]);
}

/* ------------------------------- plan card -------------------------------- */

const STATUS_COPY: Record<SubscriptionStatus, { label: string; className: string }> = {
  NONE: { label: "No subscription", className: "text-muted-foreground" },
  TRIALING: { label: "Trial", className: "border-sky-200 bg-sky-50 text-sky-700" },
  ACTIVE: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  // Deliberately not alarming: a failed renewal is retried and nothing is cut off.
  PAST_DUE: { label: "Payment failed", className: "border-amber-200 bg-amber-50 text-amber-700" },
  CANCELED: { label: "Canceled", className: "text-muted-foreground" },
};

function PlanCard({ data }: { data: BillingOverview }) {
  const status = STATUS_COPY[data.status];

  return (
    <section className="rounded-2xl border border-border bg-card p-8 shadow-card md:p-10">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-accent" /> Current plan
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">{data.plan.name}</h2>
        <Badge variant="outline" className={cn("gap-1.5", status.className)}>
          {status.label}
        </Badge>
        {data.cancelAtPeriodEnd && (
          <Badge variant="outline" className="text-muted-foreground">
            Ends at period close
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{data.plan.tagline}</p>

      <NextCharge data={data} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {/* Only rendered when Stripe is actually charging something. A free
            plan has no price, which is not a price of zero. */}
        {data.unitAmount !== null && (
          <Fact
            label="Price"
            value={`${formatMoney(data.unitAmount, data.currency)} / ${
              data.interval === "YEARLY" ? "year" : "month"
            }`}
          />
        )}
        <Fact
          label={data.cancelAtPeriodEnd ? "Access until" : "Renews"}
          // Blank rather than invented: a company that never subscribed has no
          // renewal date, and any date shown here would be fiction.
          value={data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : "—"}
        />
        <Fact label="Company" value={data.company.name} />
      </div>

      {data.status === "PAST_DUE" && (
        <Notice
          tone="warning"
          icon={AlertTriangle}
          title="Your last payment didn't go through"
          className="mt-6"
        >
          Nothing has been switched off. Your bank will be retried automatically, and an owner can
          update the card from the billing portal.
        </Notice>
      )}
    </section>
  );
}

/**
 * What you will pay next, and when, in one sentence.
 *
 * The price and the renewal date were already on this card as two separate
 * facts, leaving the reader to multiply and to work out whether a cancellation
 * had already been scheduled. Every branch here is built from figures Stripe
 * gave us; where one is missing the sentence gets shorter rather than guessing.
 */
function NextCharge({ data }: { data: BillingOverview }) {
  const amount = data.unitAmount === null ? null : formatMoney(data.unitAmount, data.currency);
  const when = data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : null;

  let sentence: React.ReactNode;

  if (data.cancelAtPeriodEnd) {
    // Nothing further is owed, and saying "next charge" here would be false.
    sentence = when
      ? <>Nothing more to pay. Your plan ends on <strong>{when}</strong> and you return to Starter.</>
      : <>Nothing more to pay — your plan is set to end.</>;
  } else if (amount === null) {
    // A free plan has no price, which is not a price of zero.
    sentence = <>You are on {data.plan.name}. There is nothing to pay.</>;
  } else if (when) {
    sentence = <>Next charge <strong>{amount}</strong> on <strong>{when}</strong>.</>;
  } else {
    // Subscribed, but Stripe has not told us the period end yet.
    sentence = <><strong>{amount}</strong> per {data.interval === "YEARLY" ? "year" : "month"}.</>;
  }

  return <p className="mt-4 text-sm text-foreground">{sentence}</p>;
}

/* --------------------------------- usage ---------------------------------- */

function UsageSection({ data }: { data: BillingOverview }) {
  const { seats, activeJobs, aiOperations, boosts } = data.usage;

  return (
    <section>
      <SectionHeading
        eyebrow="Usage"
        title="Usage & limits"
        description={
          data.usagePeriod.basis === "billing-period"
            ? `AI operations counted since ${formatDate(data.usagePeriod.start)}, when this billing period began.`
            : `AI operations counted this calendar month, since ${formatDate(data.usagePeriod.start)}.`
        }
      />

      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${boosts ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <UsageCard label="Team seats" line={seats} />
        <UsageCard label="Active job posts" line={activeJobs} />
        <UsageCard label="AI operations" line={aiOperations} />
        {boosts && <UsageCard label="Job boosts" line={boosts} />}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Seats, job posts and boosts are counted live from your team and your board. AI operations are
        totalled as they happen. AI operations and boosts reset each period.
      </p>
    </section>
  );
}

function UsageCard({ label, line }: { label: string; line: UsageLine }) {
  const limit = line.limit;
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.round((line.used / Math.max(limit, 1)) * 100);
  const atLimit = !unlimited && line.used >= limit;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{line.used.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">
          {/* An em dash, not a number: unlimited has no ceiling to draw. */}
          {"/ "}
          {unlimited ? "—" : limit.toLocaleString()}
        </span>
      </div>
      {!unlimited && limit > 0 && <UsageBar value={pct} className="mt-3" />}
      {limit === 0 ? (
        // Nothing was used up — the plan simply doesn't include it.
        <p className="mt-2 text-xs text-muted-foreground">Not included on your plan.</p>
      ) : (
        atLimit && (
          <p className="mt-2 text-xs text-amber-700">
            You have reached this limit on your plan.
          </p>
        )
      )}
    </div>
  );
}

/* ------------------------------ plan comparison ---------------------------- */

function PlanComparison({
  plans,
  loading,
  error,
  overview,
}: {
  plans?: PlanEntitlement[];
  loading: boolean;
  error: boolean;
  overview: BillingOverview;
}) {
  const [interval, setInterval] = useState<BillingInterval>(overview.interval ?? "MONTHLY");

  const upgrade = useMutation({
    mutationFn: (plan: PlanEntitlement) => startCheckout(plan.id, interval),
    // A full navigation, not a new tab: checkout is a destination, and the
    // success URL brings them straight back here.
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section>
      <SectionHeading
        eyebrow="Plans"
        title="Compare plans"
        description="Compare pricing, features, and limits for your team. Choose monthly or yearly billing to see available prices."
      />

      <div className="mt-5 inline-flex rounded-lg border border-border p-0.5">
        {(["MONTHLY", "YEARLY"] as BillingInterval[]).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              interval === i ? "bg-navy text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {i === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-destructive">
          Couldn't load plan details. Refresh the page to try again.
        </p>
      )}

      {plans && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => {
            const current = p.id === overview.plan.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-5",
                  current ? "border-navy" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  {current && (
                    <Badge variant="outline" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                <PriceLine price={p.price} interval={interval} />
                <dl className="mt-4 space-y-1.5 text-sm">
                  <Limit label="Seats" value={p.seats} />
                  <Limit label="Active job posts" value={p.activeJobs} />
                  <Limit label="AI operations" value={p.aiOperations} />
                  {p.boosts !== undefined && <Limit label="Job boosts" value={p.boosts} />}
                </dl>
                {p.features.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="capitalize">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto pt-4">
                  <PlanAction
                    plan={p}
                    current={current}
                    currentPlan={overview.plan.id}
                    interval={interval}
                    canManage={overview.canManageBilling}
                    pending={upgrade.isPending && upgrade.variables?.id === p.id}
                    onUpgrade={() => upgrade.mutate(p)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * What a plan costs, or the honest reason there is no figure.
 *
 * The four cases are kept apart deliberately: free, negotiated, and "we could
 * not read the price" all arrive as a missing number, and printing any of them
 * as $0 would quote a price nobody set. See PlanPrice in lib/api/billing.
 */
function PriceLine({ price, interval }: { price: PlanPrice; interval: BillingInterval }) {
  if (price.kind === "free") {
    return <p className="mt-3 text-2xl font-semibold tracking-tight">Free</p>;
  }
  if (price.kind === "custom") {
    return (
      <div className="mt-3">
        <p className="text-2xl font-semibold tracking-tight">Custom</p>
        <p className="text-xs text-muted-foreground">Priced with our team.</p>
      </div>
    );
  }
  if (price.kind === "unavailable") {
    // Said plainly. A plan whose price we cannot read is not a free plan.
    return (
      <div className="mt-3">
        <p className="text-sm font-medium text-muted-foreground">Price unavailable</p>
        <p className="text-xs text-muted-foreground">{price.reason}</p>
      </div>
    );
  }

  const amount = amountFor(price, interval);
  if (amount === null) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Not sold {interval === "YEARLY" ? "yearly" : "monthly"}.
      </p>
    );
  }

  const saving = interval === "YEARLY" ? annualSaving(price) : null;
  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatMoney(amount, price.currency)}
        </span>
        <span className="text-sm text-muted-foreground">
          / {interval === "YEARLY" ? "year" : "month"}
        </span>
      </div>
      {/* Only when both real prices are known — a saving computed against an
          assumed monthly price is a marketing number, not a fact. */}
      {saving !== null && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Saves {formatMoney(saving, price.currency)} a year
        </p>
      )}
    </div>
  );
}

/**
 * The button under a plan, or the honest absence of one.
 *
 * Starter cannot be "bought" and Enterprise is negotiated — the server refuses
 * checkout for both, so neither gets a button that would only produce an error.
 *
 * The label names the direction of travel. It used to read "Upgrade to {name}"
 * for every plan that was not the current one, so a company on Enterprise was
 * invited to *upgrade* to Pro — which is a downgrade, and which the server
 * accepted. Both halves of that are now closed; see createCheckoutSession.
 */
function PlanAction({
  plan,
  current,
  currentPlan,
  interval,
  canManage,
  pending,
  onUpgrade,
}: {
  plan: PlanEntitlement;
  current: boolean;
  currentPlan: PlanEntitlement["id"];
  interval: BillingInterval;
  canManage: boolean;
  pending: boolean;
  onUpgrade: () => void;
}) {
  if (current) {
    return <p className="text-xs text-muted-foreground">Your current plan.</p>;
  }
  /**
   * An Enterprise company is on negotiated terms, so no self-serve checkout is
   * offered in either direction — the server refuses it for the same reason.
   */
  if (currentPlan === "ENTERPRISE") {
    return (
      <p className="text-xs text-muted-foreground">
        Your plan is arranged with our team. Talk to us before changing it.
      </p>
    );
  }
  if (plan.id === "ENTERPRISE") {
    return (
      <p className="text-xs text-muted-foreground">
        Arranged with our team rather than bought online.
      </p>
    );
  }
  if (plan.id === "STARTER") {
    return (
      <p className="text-xs text-muted-foreground">
        Cancel your plan from the billing portal to return to Starter.
      </p>
    );
  }
  if (!canManage) {
    // Says who can, rather than leaving a dead button to poke at.
    return (
      <p className="text-xs text-muted-foreground">
        Your company owner can change the plan.
      </p>
    );
  }
  /**
   * Checkout needs a price id, and without one the server answers "billing is
   * not configured for this plan yet". Better to say so than to hand over a
   * button whose only outcome is that message.
   */
  if (amountFor(plan.price, interval) === null) {
    return (
      <p className="text-xs text-muted-foreground">
        Not available to buy {interval === "YEARLY" ? "yearly" : "monthly"} right now.
      </p>
    );
  }

  /**
   * "Switch" is not reachable today: Pro is the only self-serve plan, Starter
   * and Enterprise are handled above, and an Enterprise company never gets
   * here — so the only journey left is Starter → Pro. It stays because the
   * rank comparison is what makes adding a fourth plan safe, and because
   * hard-coding "Upgrade" is precisely the bug this replaced.
   */
  const moving = planRank(plan.id) > planRank(currentPlan) ? "Upgrade" : "Switch";
  return (
    <Button size="sm" className="w-full" onClick={onUpgrade} disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {moving} to {plan.name}
    </Button>
  );
}

function Limit({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value === null ? "Unlimited" : value.toLocaleString()}</dd>
    </div>
  );
}

/* -------------------------------- payment --------------------------------- */

/**
 * Cards and invoices, which live in Stripe's hosted portal.
 *
 * Nothing about a card is stored or rendered by us — that is the whole point
 * of the portal, and it keeps the application out of PCI scope. The in-app
 * card form that used to sit here collected a raw card number into browser
 * state and was removed rather than wired up.
 */
function PaymentSection({ overview }: { overview: BillingOverview }) {
  const portal = useMutation({
    mutationFn: openBillingPortal,
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section>
      <SectionHeading
        eyebrow="Payment"
        title="Payment methods & invoices"
        description="Cards, invoices, receipts and cancellation."
      />

      {overview.hasBillingAccount ? (
        <>
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Your cards, invoices and receipts are held by our payment provider. Coral never stores
            card details.
          </p>
          {overview.canManageBilling ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              {portal.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              )}
              Manage billing
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only your company owner can reach payment details.
            </p>
          )}
        </div>

        {/* Invoices are payment data, so they follow the same owner-only line
            as the portal button above. */}
        {overview.canManageBilling && <InvoiceList />}
        </>
      ) : (
        // No customer at Stripe means no portal to open. Said plainly instead
        // of showing a button that would fail.
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">No billing account yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            You are on a free plan, so there is nothing to pay and no invoices to show. Upgrading
            creates your billing account.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Invoices, straight from Stripe.
 *
 * Every row links to Stripe's own hosted invoice and PDF. We deliberately do
 * not render a receipt of our own: two documents for one charge is how a
 * customer ends up with two disagreeing records in their accounts.
 */
function InvoiceList() {
  const invoices = useQuery({ queryKey: ["billing", "invoices"], queryFn: getInvoices });

  if (invoices.isLoading) {
    return <Skeleton className="mt-4 h-32 rounded-xl" />;
  }

  if (invoices.isError) {
    return (
      <Notice tone="error" icon={AlertTriangle} title="Couldn't load invoices" className="mt-4">
        {(invoices.error as Error).message}
      </Notice>
    );
  }

  if (!invoices.data || invoices.data.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No invoices yet. Your first one appears after your first payment.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Invoice</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Amount</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {invoices.data.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  // Stripe's own vocabulary, not a re-labelling of it: "open" and "uncollectible"
  // mean specific things on a real invoice and renaming them loses that.
  const tone =
    invoice.status === "paid"
      ? "text-emerald-700"
      : invoice.status === "open" || invoice.status === "uncollectible"
        ? "text-amber-700"
        : "text-muted-foreground";

  // An unpaid invoice shows what is owed; a paid one shows what was taken.
  const amount = invoice.status === "paid" ? invoice.amountPaid : invoice.amountDue;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-medium">{invoice.number ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.createdAt)}</td>
      <td className="px-4 py-3 tabular-nums">{formatMoney(amount, invoice.currency)}</td>
      <td className={cn("px-4 py-3 capitalize", tone)}>{invoice.status}</td>
      <td className="px-4 py-3 text-right">
        {invoice.pdfUrl || invoice.hostedUrl ? (
          <a
            href={(invoice.pdfUrl ?? invoice.hostedUrl) as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </a>
        ) : null}
      </td>
    </tr>
  );
}

/* -------------------------------- fragments -------------------------------- */

function LoadingState() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  children,
  className,
}: {
  tone: "error" | "warning" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    muted: "border-border bg-card text-foreground",
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-5", tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm opacity-90">{children}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
