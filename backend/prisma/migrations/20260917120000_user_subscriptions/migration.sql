-- Job seeker Premium subscriptions (billed per person).
-- Deliberately separate from company_subscriptions: a different product with a
-- different payer. Reuses the existing SubscriptionStatus / BillingInterval enums.
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'cad',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "unit_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_subscriptions_user_id_key" ON "user_subscriptions"("user_id");
-- One customer and one subscription per row: the guard against two concurrent
-- checkouts splitting someone's billing history across two Stripe customers.
CREATE UNIQUE INDEX "user_subscriptions_stripe_customer_id_key" ON "user_subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "user_subscriptions_stripe_subscription_id_key" ON "user_subscriptions"("stripe_subscription_id");

ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
