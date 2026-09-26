-- Live (conversational) AI screening.
--
-- A live screen reuses the interview-coach session machinery for the actual
-- run — turn-taking, per-answer evaluation, transcript, resume-after-refresh —
-- and keeps ai_screens as the employer-facing invitation + scorecard.
ALTER TABLE "interview_coach_sessions" ADD COLUMN "screen_id" TEXT;

-- One run per screening: a candidate cannot restart to get a better score.
CREATE UNIQUE INDEX "interview_coach_sessions_screen_id_key"
  ON "interview_coach_sessions"("screen_id");

-- Explicit consent, captured before the interview starts. A live screen is
-- recorded and transcribed, so starting one must be a deliberate act with a
-- decline path — not an implied consequence of opening a link.
ALTER TABLE "ai_screens" ADD COLUMN "consent_at" TIMESTAMP(3);
ALTER TABLE "ai_screens" ADD COLUMN "duration_sec" INTEGER;
