-- Job seeker Premium, phase 4: admin comps, kept apart from Stripe's grant.
--
-- The effective tier is (stripe_entitled OR comped_until > now). Storing the two
-- sources separately means a lapsed card can't end a comp, and a comp ending
-- can't end a paid subscription.
ALTER TABLE "user_subscriptions"
    ADD COLUMN "stripe_entitled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "comped_until" TIMESTAMP(3),
    ADD COLUMN "comp_reason" TEXT,
    ADD COLUMN "comped_by_id" TEXT;

ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_comped_by_id_fkey"
    FOREIGN KEY ("comped_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rows written before this column existed: whatever Stripe currently grants is
-- what the tier flag already reflects for anyone with a live subscription.
UPDATE "user_subscriptions" s
SET "stripe_entitled" = true
FROM "users" u
WHERE u."id" = s."user_id"
  AND u."subscription_tier" = 'premium'
  AND s."status" IN ('ACTIVE', 'TRIALING', 'PAST_DUE');

-- Finds comps that have run out, for the nightly expiry sweep.
CREATE INDEX "user_subscriptions_comped_until_idx" ON "user_subscriptions"("comped_until");
