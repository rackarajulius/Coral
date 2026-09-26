-- AlterTable: JobSeekerProfile — work eligibility (Canada market)
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "work_eligibility" TEXT,
    ADD COLUMN "work_permit_expiry" TEXT;
