/**
 * Price arithmetic for the plan cards. Every figure is worked out from the
 * prices Stripe holds — nothing here is typed in — so a card can't advertise a
 * saving the prices don't give.
 */

export interface PlanPrice {
  interval: "MONTHLY" | "YEARLY";
  /** Smallest currency unit, as Stripe charges it. */
  unitAmount: number;
  currency: string;
}

/** "$10", or "$4.17" when there are cents: whole prices read without ".00". */
export function formatPlanPrice(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2,
  }).format(unitAmount / 100);
}

/** A yearly price spread over twelve months, in the smallest unit. */
export function perMonth(yearly: PlanPrice): number {
  return Math.round(yearly.unitAmount / 12);
}

/**
 * Whole percent saved by paying yearly instead of twelve monthly payments.
 * Null when there's nothing honest to claim: different currencies, or no saving.
 */
export function yearlySaving(monthly: PlanPrice | undefined, yearly: PlanPrice | undefined): number | null {
  if (!monthly || !yearly || monthly.currency.toLowerCase() !== yearly.currency.toLowerCase()) return null;
  const twelve = monthly.unitAmount * 12;
  if (twelve <= 0) return null;
  const saving = Math.floor(((twelve - yearly.unitAmount) / twelve) * 100);
  return saving > 0 ? saving : null;
}

/** "2 a month", "20 a day", "Unlimited"; null when the plan doesn't include it. */
export function allowanceText(limit: number | null, window: "day" | "month"): string | null {
  if (limit === null) return "Unlimited";
  if (limit === 0) return null;
  return `${limit} a ${window}`;
}
