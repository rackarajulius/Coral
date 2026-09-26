-- Remember the last parsed resume summary so flows (e.g. the interview coach)
-- can reuse it without asking for another upload. The file itself is not stored.
ALTER TABLE "job_seeker_profiles" ADD COLUMN "parsed_resume" JSONB;
