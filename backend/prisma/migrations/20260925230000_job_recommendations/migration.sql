-- Job → seeker matching: publish fan-out marker, delivered recommendations,
-- and paid boosts. Additive only.

ALTER TABLE "jobs" ADD COLUMN "fanned_out_at" TIMESTAMP(3);

-- Jobs already live when this ships are treated as fanned out, so the first
-- sweep does not suddenly announce weeks-old postings to everyone.
UPDATE "jobs" SET "fanned_out_at" = CURRENT_TIMESTAMP WHERE "status" = 'active';

CREATE TABLE "job_recommendations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'publish',
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "job_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_recommendations_job_id_user_id_key" ON "job_recommendations"("job_id", "user_id");
CREATE INDEX "job_recommendations_user_id_notified_at_idx" ON "job_recommendations"("user_id", "notified_at");
CREATE INDEX "job_recommendations_notified_at_created_at_idx" ON "job_recommendations"("notified_at", "created_at");

ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "job_boosts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "company_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "second_wave_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_boosts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_boosts_job_id_status_idx" ON "job_boosts"("job_id", "status");
CREATE INDEX "job_boosts_status_ends_at_idx" ON "job_boosts"("status", "ends_at");
CREATE INDEX "job_boosts_company_id_created_at_idx" ON "job_boosts"("company_id", "created_at");

ALTER TABLE "job_boosts" ADD CONSTRAINT "job_boosts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
