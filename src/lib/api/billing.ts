import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/employers/billing${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't load billing");
  }
  return (await res.json()).data as T;
}

export type PlanId = "STARTER" | "PRO" | "ENTERPRISE";
export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type BillingInterval = "MONTHLY" | "YEARLY";
export type GatedFeature = "analytics" | "integrations" | "webhooks";

/**
 * `limit: null` means unlimited, not zero. It renders as an em dash — an
 * unlimited plan does not have a limit of one million.
 */
export interface UsageLine {
  used: number;
  limit: number | null;
  /** 'derived' is counted from live rows; 'metered' accumulates from events. */
  basis: "derived" | "metered";
  breakdown?: Record<string, number>;
}

/** Returned when the viewer belongs to no company — nothing to bill, not an error. */
export interface NoCompanyOverview {
  company: null;
  reason: string;
}

export interface BillingOverview {
  company: { id: string; name: string };
  viewerRole: string;
  /** Derived server-side from the same capability table the guard uses. */
  canManageBilling: boolean;
  /** Whether a Stripe customer exists — the id itself never leaves the server. */
  hasBillingAccount: boolean;
  plan: { id: PlanId; name: string; tagline: string };
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  currency: string;
  /**
   * What Stripe charges per period, in the currency's smallest unit.
   * Null on a free plan: nothing is charged, which is not a charge of zero.
   */
  unitAmount: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usagePeriod: {
    start: string;
    end: string | null;
    basis: "billing-period" | "calendar-month";
  };
  usage: {
    seats: UsageLine;
    activeJobs: UsageLine;
    aiOperations: UsageLine;
    /** Job boosts started this period. Optional: older servers do not send it. */
    boosts?: UsageLine;
  };
  features: GatedFeature[];
}

export interface Invoice {
  id: string;
  /** Stripe's human-facing number. Absent on drafts. */
  number: string | null;
  createdAt: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string;
  /** Stripe-hosted. We never generate a second document for the same charge. */
  hostedUrl: string | null;
  pdfUrl: string | null;
}

/**
 * What a plan costs, as one of the four things that can be true.
 *
 * "Free", "negotiated" and "we could not read the price" are three different
 * facts that all render as a missing number; keeping them apart is what stops a
 * plan whose price id is unset being advertised as $0. Amounts are in the
 * currency's smallest unit, like every other figure Stripe gives us, and
 * `yearly` is a whole year's charge rather than a monthly equivalent.
 */
export type PlanPrice =
  | { kind: "free" }
  | { kind: "custom" }
  | { kind: "listed"; currency: string; monthly: number | null; yearly: number | null }
  | { kind: "unavailable"; reason: string };

export interface PlanEntitlement {
  id: PlanId;
  name: string;
  tagline: string;
  seats: number | null;
  activeJobs: number | null;
  aiOperations: number | null;
  /** Job boosts per period. Null is unlimited. */
  boosts?: number | null;
  features: GatedFeature[];
  /** Read from the same Stripe price id checkout charges against. */
  price: PlanPrice;
}

/**
 * What a year on the yearly price saves against twelve monthly ones.
 *
 * Null unless both figures are known — a saving computed from one real price
 * and one assumption is a marketing number, not a fact.
 */
export function annualSaving(price: PlanPrice): number | null {
  if (price.kind !== "listed") return null;
  if (price.monthly === null || price.yearly === null) return null;
  const saved = price.monthly * 12 - price.yearly;
  return saved > 0 ? saved : null;
}

/** What this plan charges for the chosen interval, or null if not quotable. */
export function amountFor(price: PlanPrice, interval: BillingInterval): number | null {
  if (price.kind !== "listed") return null;
  return interval === "YEARLY" ? price.yearly : price.monthly;
}

/**
 * Cheapest first. Used to tell an upgrade from a downgrade, so the button
 * under a plan can never invite someone to "upgrade" to less than they have.
 */
export const PLAN_ORDER: PlanId[] = ["STARTER", "PRO", "ENTERPRISE"];

export const planRank = (plan: PlanId): number => PLAN_ORDER.indexOf(plan);

export const hasCompany = (o: BillingOverview | NoCompanyOverview): o is BillingOverview =>
  o.company !== null;

export const getBillingOverview = () =>
  req<BillingOverview | NoCompanyOverview>("/overview");

export const getPlanEntitlements = () =>
  req<{ plans: PlanEntitlement[] }>("/entitlements").then((r) => r.plans);

/**
 * Starts an upgrade. Returns a Stripe-hosted URL to send the browser to.
 *
 * Nothing changes locally until Stripe confirms over the webhook, so a closed
 * checkout tab grants nothing.
 */
export const startCheckout = (plan: PlanId, interval: BillingInterval) =>
  req<{ url: string }>("/checkout", {
    method: "POST",
    body: JSON.stringify({
      plan,
      interval,
      successUrl: `${window.location.origin}/employers/billing?upgraded=1`,
      cancelUrl: `${window.location.origin}/employers/billing`,
    }),
  });

/** Invoices, read live from Stripe. Owner-only — these are payment data. */
export const getInvoices = () =>
  req<{ invoices: Invoice[] }>("/invoices").then((r) => r.invoices);

/** Opens Stripe's portal, where cards, invoices and cancellation live. */
export const openBillingPortal = () =>
  req<{ url: string }>("/portal", {
    method: "POST",
    body: JSON.stringify({ returnUrl: `${window.location.origin}/employers/billing` }),
  });

/**
 * Stripe reports money in the currency's smallest unit. Formatted with the
 * currency shown explicitly, because "$49" means different amounts in CAD and
 * USD and this platform bills in both.
 */
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minorUnits / 100);
}
