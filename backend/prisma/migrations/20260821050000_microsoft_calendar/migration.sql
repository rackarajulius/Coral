-- Microsoft 365 calendar, with Teams meetings.
--
-- Per user, like Google: a calendar belongs to a recruiter, not to a company.
--
-- Outlook and Teams are one integration, not two. Microsoft Graph returns a
-- Teams join URL from the same call that creates the calendar event, so there
-- is nothing separate to connect.
CREATE TABLE "microsoft_credentials" (
  "user_id"        TEXT NOT NULL,
  "microsoft_email" TEXT,
  "refresh_token"  TEXT NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "microsoft_credentials_pkey" PRIMARY KEY ("user_id")
);

-- Which calendar backs calendar_event_id.
--
-- Without this, cancelling an interview booked before a provider switch would
-- send the delete to the wrong API — a 404 at best, and at worst a stale event
-- sitting in someone's calendar with a dead join link.
ALTER TABLE "interviews"
  ADD COLUMN IF NOT EXISTS "calendar_provider" TEXT;

UPDATE "interviews" SET "calendar_provider" = 'google'
WHERE "calendar_event_id" IS NOT NULL AND "calendar_provider" IS NULL;
