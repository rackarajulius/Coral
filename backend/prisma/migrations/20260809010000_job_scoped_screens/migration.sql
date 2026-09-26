-- Job-scoped AI screening.
--
-- Screens were keyed on (employer, candidate) with a free-text role, so two
-- candidates for the same job could be asked different questions and their
-- scores were not comparable. Scoping a screen to a job — and generating ONE
-- question set per job — makes a ranked view of applicants meaningful.
ALTER TABLE "ai_screens" ADD COLUMN "job_id" TEXT;
ALTER TABLE "ai_screens" ADD COLUMN "application_id" TEXT;

-- Ranking reads: applicants for a job, best score first. NULLS LAST so
-- not-yet-completed screens sort after scored ones rather than above them.
CREATE INDEX "ai_screens_job_id_overall_score_idx"
  ON "ai_screens"("job_id", "overall_score" DESC NULLS LAST);

-- Dedupe reads: "who on this job has already been invited?"
CREATE INDEX "ai_screens_job_id_candidate_id_idx"
  ON "ai_screens"("job_id", "candidate_id");

-- The shared question set for a job, generated once and reused for every
-- candidate screened against it. Regenerating is deliberate (and warns the
-- employer that existing scores stop being comparable).
ALTER TABLE "jobs" ADD COLUMN "screening_questions" JSONB;
ALTER TABLE "jobs" ADD COLUMN "screening_generated_at" TIMESTAMP(3);
