-- How candidates apply to a job, chosen by the employer/recruiter/admin when
-- posting: internal (Quick Apply on-platform), external (company website), or
-- email. The post-job form already collected these; they were being discarded.
ALTER TABLE "jobs" ADD COLUMN "application_method" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "jobs" ADD COLUMN "application_url" TEXT;
ALTER TABLE "jobs" ADD COLUMN "application_email" TEXT;
