import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type BillingInterval = "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface MySubscription {
  tier: "free" | "premium";
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Smallest currency unit, exactly as Stripe charges it. */
  unitAmount: number | null;
  currency: string | null;
  hasBillingAccount: boolean;
  /** A paid subscription is granting Premium right now (includes a payment being retried). */
  paid: boolean;
  /** Complimentary Premium given by the team, while it lasts. Null otherwise. */
  compedUntil: string | null;
}

export interface PremiumPlans {
  /** False until real prices are set up in Stripe — nothing is on sale yet. */
  available: boolean;
  prices: { interval: BillingInterval; unitAmount: number; currency: string }[];
  /** The same registry the server meters against. null = unlimited, 0 = not included. */
  tiers: {
    metric: string;
    label: string;
    window: "day" | "month";
    free: number | null;
    premium: number | null;
    /** False when the feature's provider isn't set up — shown as coming soon, never sold. */
    live: boolean;
  }[];
}

/** Sends the session when there is one; the plans route works without it. */
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || "Request failed");
  return (body as { data: T }).data;
}

/** The caller's own subscription. Requires a signed-in job seeker. */
const MINE = "/job-seekers/me/subscription";

export const getMySubscription = () => req<MySubscription>(MINE);

/**
 * What Premium costs and includes — public, so the page can explain Premium to
 * someone who hasn't signed in. Lives outside `/me` for that reason.
 */
export const getPremiumPlans = () => req<PremiumPlans>("/premium/plans");

/**
 * Starts checkout and leaves for Stripe. Only a path is sent: the server joins
 * it to the site's own address, so this can never become a redirect elsewhere.
 */
export async function startPremiumCheckout(interval: BillingInterval, returnPath: string) {
  const { url } = await req<{ url: string }>(`${MINE}/checkout`, {
    method: "POST",
    body: JSON.stringify({ interval, returnPath }),
  });
  window.location.assign(url);
}

export async function openBillingPortal(returnPath: string) {
  const { url } = await req<{ url: string }>(`${MINE}/portal`, {
    method: "POST",
    body: JSON.stringify({ returnPath }),
  });
  window.location.assign(url);
}

/** Stripe's own cancellation reasons, so they reach its reports as they are. */
export type CancelReason =
  | "too_expensive"
  | "unused"
  | "missing_features"
  | "switched_service"
  | "too_complex"
  | "low_quality"
  | "customer_service"
  | "other";

export const CANCEL_REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: "too_expensive", label: "It costs too much" },
  { value: "unused", label: "I'm not using it enough" },
  { value: "missing_features", label: "It's missing something I need" },
  { value: "switched_service", label: "I found something else" },
  { value: "too_complex", label: "It's hard to use" },
  { value: "low_quality", label: "It didn't work well enough" },
  { value: "customer_service", label: "I had a problem with support" },
  { value: "other", label: "Something else" },
];

/**
 * Cancels Premium at the end of the period already paid for. Returns the
 * subscription as it now stands. Asking twice changes nothing.
 */
export const cancelPremium = (input: { reason?: CancelReason; comment?: string } = {}) =>
  req<MySubscription>(`${MINE}/cancel`, { method: "POST", body: JSON.stringify(input) });

/**
 * Asks the server to check with Stripe now, rather than wait for Stripe's
 * webhook. Used on the way back from checkout. Returns the subscription.
 */
export const syncPremium = () => req<MySubscription>(`${MINE}/sync`, { method: "POST" });

/** Undoes a cancellation before the period ends: Premium renews as before. */
export const keepPremium = () => req<MySubscription>(`${MINE}/keep`, { method: "POST" });

/** "CA$9.99" — formatted from Stripe's own amount and currency, never typed in. */
export function formatPrice(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
    unitAmount / 100,
  );
}

/**
 * A comp's end date as a whole UTC day — the same date the person's email
 * names, whatever their time zone.
 */
export function formatCompDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What keeps someone on Premium, in short phrases. Billing details appear only
 * when a paid plan is what grants it — a cancelled subscription left over from
 * before a comp says nothing.
 */
export function premiumSummary(sub: MySubscription): string[] {
  const parts: string[] = [];
  if (sub.paid) {
    if (sub.currentPeriodEnd) {
      const end = new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      parts.push(`${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} ${end}`);
    }
    if (sub.unitAmount !== null && sub.currency) {
      parts.push(`${formatPrice(sub.unitAmount, sub.currency)} / ${sub.interval === "YEARLY" ? "year" : "month"}`);
    }
  }
  if (sub.compedUntil) {
    parts.push(`${sub.paid ? "Also complimentary" : "Complimentary"} until ${formatCompDate(sub.compedUntil)}`);
  }
  return parts;
}
