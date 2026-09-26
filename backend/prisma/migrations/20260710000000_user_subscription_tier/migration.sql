-- Subscription tier gating for premium features (e.g. web-wide resume matcher).
ALTER TABLE "users" ADD COLUMN "subscription_tier" TEXT NOT NULL DEFAULT 'free';
