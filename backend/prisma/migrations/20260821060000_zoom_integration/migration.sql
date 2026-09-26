-- Zoom, per user.
--
-- Unlike Google and Microsoft this is not a calendar — it only creates the
-- meeting. So Zoom composes with a calendar rather than replacing it: the Zoom
-- link goes into whichever calendar event the employer's provider creates, and
-- when no calendar is connected the link stands on its own (the platform
-- already emails an .ics either way).
CREATE TABLE "zoom_credentials" (
  "user_id"       TEXT NOT NULL,
  "zoom_email"    TEXT,
  "refresh_token" TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoom_credentials_pkey" PRIMARY KEY ("user_id")
);

-- Zoom's own meeting id, so cancelling deletes the meeting as well as the
-- calendar entry. Distinct from calendar_event_id: with Zoom plus a calendar
-- there are two objects to clean up, in two different systems.
ALTER TABLE "interviews"
  ADD COLUMN IF NOT EXISTS "zoom_meeting_id" TEXT;
