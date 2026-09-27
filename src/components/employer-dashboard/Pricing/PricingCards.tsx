import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BACKEND_PLAN, pricingPlans } from '@/data/employer/pricing/pricing';
import { cn } from '@/libs/utils';
import { ArrowRight, Check } from 'lucide-react';
import React from 'react'
import PriceDisplay from './PriceDisplay';
import { amountFor, formatMoney, getPlanEntitlements } from '@/lib/api/billing';

const PricingCards = ({ yearly }: { yearly: boolean }) => {
  /**
   * The same query key and figures the billing page uses, so what is advertised
   * here and what is charged at checkout cannot drift apart. This file used to
   * read hard-coded numbers that nothing reconciled against Stripe.
   */
  const plans = useQuery({
    queryKey: ["billing", "entitlements"],
    queryFn: getPlanEntitlements,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  return (
     <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 md:grid-cols-3 md:items-stretch">
      {pricingPlans.map((plan) => {
        const price = plans.data?.find((p) => p.id === BACKEND_PLAN[plan.id])?.price;
        const annual = price ? amountFor(price, "YEARLY") : null;
        const monthly = price ? amountFor(price, "MONTHLY") : null;
        const featured = plan.featured;
        const Icon = plan.icon;
        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-7 transition-all duration-300",
              featured
                ? "border border shadow-elevated md:-my-2 md:scale-[1.02]"
                : "border-border shadow-card hover:shadow-elevated hover:-translate-y-0.5"
            )}
          >
            {/* gradient border for featured */}
            {featured && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 rounded-2xl p-[1.5px]"                 
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px -z-20 rounded-2xl opacity-60 blur-2xl"
                />
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-orange-500 px-3 py-1 text-[11px]  tracking-wider text-background">
                  Most popular
                </Badge>
              </>
            )}

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon className="h-4 w-4" />
              {plan.name}
            </div>

            <div className="mt-5">
              <PriceDisplay price={price} yearly={yearly} />
              {/* The figure that actually leaves the bank, beside the per-month
                  one. Only drawn when both real prices are known — striking
                  through an assumed monthly price would invent the saving. */}
              {yearly && price?.kind === "listed" && annual !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {monthly !== null && (
                    <span className="line-through">{formatMoney(monthly, price.currency)}/mo</span>
                  )}
                  {monthly !== null && " · "}
                  {formatMoney(annual, price.currency)}/yr total
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{plan.tagline}</p>
            </div>

            <ul className="mt-5 space-y-3">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm text-foreground/90">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      featured ? "bg-accent/15 text-accent" : "bg-secondary text-foreground/70"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {h}
                </li>
              ))}
            </ul>

             <Button
              size="lg"
              className={cn(
                "mt-7 w-full ",
                featured
                  ? "bg-orange-500 text-background"
                  : plan.id === "free"
                  ? "text-foreground"
                  : ""
              )}
              variant={featured ? "default" : plan.id === "free" ? "outline" : "outline"}
            >
              {plan.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  )
}

export default PricingCards
