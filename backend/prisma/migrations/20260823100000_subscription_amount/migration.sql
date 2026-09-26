-- The amount Stripe actually charges, so the billing page can state a price
-- instead of repeating one hard-coded in the UI. Nullable because a company
-- with no subscription has no price — not a price of zero.
ALTER TABLE "company_subscriptions" ADD COLUMN "unit_amount" INTEGER;
