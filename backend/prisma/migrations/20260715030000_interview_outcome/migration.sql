-- Post-interview outcome (no-ghosting) + private scorecard.
ALTER TABLE "interviews" ADD COLUMN "outcome" TEXT;
ALTER TABLE "interviews" ADD COLUMN "outcome_note" TEXT;
ALTER TABLE "interviews" ADD COLUMN "outcome_at" TIMESTAMP(3);
ALTER TABLE "interviews" ADD COLUMN "feedback" JSONB;
ALTER TABLE "interviews" ADD COLUMN "nudged_at" TIMESTAMP(3);
