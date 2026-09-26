-- AlterTable: JobSeekerProfile — profile photo (Supabase Storage URL)
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "avatar_url" TEXT;
