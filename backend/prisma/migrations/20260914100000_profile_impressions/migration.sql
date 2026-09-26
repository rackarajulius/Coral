-- Profile impressions: views of a candidate's profile, and appearances in an
-- employer's candidate search.
--
-- One row per (candidate, type, viewer, day): a refresh does not inflate a
-- count, and re-running the same search all afternoon is one appearance.
CREATE TABLE "profile_impressions" (
    "id" TEXT NOT NULL,
    "job_seeker_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "viewer_company_id" TEXT,
    "day" DATE NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_impressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_impressions_job_seeker_id_type_viewer_id_day_key"
    ON "profile_impressions"("job_seeker_id", "type", "viewer_id", "day");

CREATE INDEX "profile_impressions_job_seeker_id_type_day_idx"
    ON "profile_impressions"("job_seeker_id", "type", "day");

-- Supports the nightly prune of anything past the retention window.
CREATE INDEX "profile_impressions_day_idx" ON "profile_impressions"("day");

ALTER TABLE "profile_impressions" ADD CONSTRAINT "profile_impressions_job_seeker_id_fkey"
    FOREIGN KEY ("job_seeker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_impressions" ADD CONSTRAINT "profile_impressions_viewer_id_fkey"
    FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_impressions" ADD CONSTRAINT "profile_impressions_viewer_company_id_fkey"
    FOREIGN KEY ("viewer_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
