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
}

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
