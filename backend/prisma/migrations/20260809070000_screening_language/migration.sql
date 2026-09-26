-- The language a job's screening round is conducted in.
--
-- Set per JOB, not per candidate: everyone in a round must answer the same
-- questions in the same language for their scores to be comparable, and the
-- right language is a property of the role (does this job actually require
-- working in it?) rather than a candidate preference.
--
-- Interviewing someone in English for a job that does not require English
-- measures their English, not their fitness for the work.
ALTER TABLE "jobs"
  ADD COLUMN "screening_language" TEXT NOT NULL DEFAULT 'en-US';
