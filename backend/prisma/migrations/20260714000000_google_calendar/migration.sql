-- Google Calendar connections (auto Google Meet links on interviews).
CREATE TABLE "google_credentials" (
    "user_id" TEXT NOT NULL,
    "google_email" TEXT,
    "refresh_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "google_credentials_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "interviews" ADD COLUMN "calendar_event_id" TEXT;
