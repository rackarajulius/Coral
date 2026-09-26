-- Company-level billing: plan, Stripe link, and metered AI usage.
--
-- Billing is keyed to the company rather than to the user who pays, because an
-- employer account is a team. User.subscription_tier is untouched — that is
-- jobseeker premium, a different product billed to a different party.

CREATE TYPE "CompanyPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "company_subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan" "CompanyPlan" NOT NULL DEFAULT 'STARTER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'cad',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_subscriptions_company_id_key" ON "company_subscriptions"("company_id");
CREATE UNIQUE INDEX "company_subscriptions_stripe_customer_id_key" ON "company_subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "company_subscriptions_stripe_subscription_id_key" ON "company_subscriptions"("stripe_subscription_id");
CREATE INDEX "company_subscriptions_status_idx" ON "company_subscriptions"("status");

ALTER TABLE "company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only metrics that accumulate as events live here. Seats and active job posts
-- are counted from their own tables on read so they cannot drift.
CREATE TABLE "company_usage" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_usage_company_id_metric_period_start_key"
    ON "company_usage"("company_id", "metric", "period_start");
CREATE INDEX "company_usage_company_id_period_start_idx"
    ON "company_usage"("company_id", "period_start");

ALTER TABLE "company_usage"
    ADD CONSTRAINT "company_usage_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
