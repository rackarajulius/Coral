-- Jobseeker usage metering (Premium, phase 1: measured, not yet enforced).
--
-- Separate from company_usage on purpose: jobseeker Premium is billed per
-- person, employer plans per company, and the two are different products.
CREATE TABLE "user_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_usage_user_id_metric_period_start_key"
    ON "user_usage"("user_id", "metric", "period_start");

ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A coach run is charged once, at its first successful AI plan. Existing runs
-- predate metering and stay uncharged.
ALTER TABLE "interview_coach_sessions" ADD COLUMN "metered_at" TIMESTAMP(3);
