-- AlterTable: JobSeekerProfile — profile media (Supabase Storage URLs)
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "banner_url" TEXT,
    ADD COLUMN "intro_video_url" TEXT;
