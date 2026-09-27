import { Skeleton } from "@/components/ui/skeleton";
import { amountFor, formatMoney, type PlanPrice } from "@/lib/api/billing";

/**
 * A plan's headline price, from the billing API.
 *
 * On the yearly toggle this shows the **per-month equivalent** of the annual
 * charge, which is the convention buyers expect — so it is labelled as such and
 * the real annual total is printed beneath it by the card. A per-month figure
 * without "billed annually" beside it is how someone budgets for a charge a
 * twelfth the size of the one that arrives.
 */
const PriceDisplay = ({ price, yearly }: { price?: PlanPrice; yearly: boolean }) => {
  if (!price) {
    return <Skeleton className="h-12 w-40" />;
  }

  if (price.kind === "custom") {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight text-foreground">Custom</span>
      </div>
    );
  }

  if (price.kind === "free") {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight text-foreground">Free</span>
        <span className="text-sm text-muted-foreground">forever</span>
      </div>
    );
  }

  if (price.kind === "unavailable") {
    // Never a zero. A price we cannot read is not a price of nothing.
    return (
      <div>
        <p className="text-2xl font-semibold tracking-tight text-muted-foreground">
          Price unavailable
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{price.reason}</p>
      </div>
    );
  }

  const annual = amountFor(price, "YEARLY");
  const monthly = amountFor(price, "MONTHLY");
  const headline = yearly && annual !== null ? Math.round(annual / 12) : monthly;

  if (headline === null) {
    return (
      <p className="text-2xl font-semibold tracking-tight text-muted-foreground">
        Not sold {yearly ? "yearly" : "monthly"}
      </p>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-5xl font-semibold tracking-tight text-foreground">
        {formatMoney(headline, price.currency)}
      </span>
      <span className="text-sm text-muted-foreground">
        /mo{yearly && annual !== null ? ", billed annually" : ""}
      </span>
    </div>
  );
};

export default PriceDisplay;
