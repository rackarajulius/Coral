-- AlterTable: JobSeekerProfile — phone + notification/privacy settings blobs
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "notification_settings" JSONB,
    ADD COLUMN "privacy_settings" JSONB;
