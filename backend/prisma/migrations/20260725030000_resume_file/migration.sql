-- Store the resume file itself (in the PRIVATE `resumes` bucket) so it can be
-- reused across flows and shown on applications. Only the storage path is kept;
-- access is always granted through short-lived signed URLs.
ALTER TABLE "job_seeker_profiles" ADD COLUMN "resume_path" TEXT;
ALTER TABLE "job_seeker_profiles" ADD COLUMN "resume_file_name" TEXT;
ALTER TABLE "job_seeker_profiles" ADD COLUMN "resume_uploaded_at" TIMESTAMP(3);

-- Applications reference the candidate's resume by storage path (nullable:
-- older rows keep whatever URL string they already had).
ALTER TABLE "applications" ADD COLUMN "resume_path" TEXT;
