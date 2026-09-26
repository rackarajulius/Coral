-- Outreach timing: the seeker's own timezone, and scheduled delivery.

ALTER TABLE "job_seeker_profiles" ADD COLUMN "timezone" VARCHAR(64);

ALTER TABLE "outreach_messages" ADD COLUMN "scheduled_for" TIMESTAMP(3);
ALTER TABLE "outreach_messages" ADD COLUMN "sent_at" TIMESTAMP(3);
ALTER TABLE "outreach_messages" ADD COLUMN "candidate_timezone" VARCHAR(64);

-- Everything before this was sent the moment it was written.
UPDATE "outreach_messages" SET "sent_at" = "created_at" WHERE "sent_at" IS NULL AND "status" = 'sent';

CREATE INDEX "outreach_messages_status_scheduled_for_idx" ON "outreach_messages"("status", "scheduled_for");
