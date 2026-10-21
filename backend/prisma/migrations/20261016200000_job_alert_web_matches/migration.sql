-- Job alerts now search the web too, once a day at most: when it was last
-- done, and the jobs it found, so they can be shown and never announced twice.
ALTER TABLE "job_alerts" ADD COLUMN "web_checked_at" TIMESTAMP(3);
ALTER TABLE "job_alerts" ADD COLUMN "web_used_jsearch" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "job_alert_web_matches" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_key" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "url" TEXT,
    "publisher" TEXT,
    "logo_url" TEXT,
    "salary" TEXT,
    "posted_at" TIMESTAMP(3),
    "found_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_alert_web_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_alert_web_matches_alert_id_job_key_key" ON "job_alert_web_matches"("alert_id", "job_key");
CREATE INDEX "job_alert_web_matches_user_id_found_at_idx" ON "job_alert_web_matches"("user_id", "found_at");

ALTER TABLE "job_alert_web_matches" ADD CONSTRAINT "job_alert_web_matches_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "job_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
