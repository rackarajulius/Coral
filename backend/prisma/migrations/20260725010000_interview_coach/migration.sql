-- AI Interview Coach: server-side sessions + reports (replaces localStorage).
CREATE TABLE "interview_coach_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "answers" JSONB NOT NULL DEFAULT '[]',
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "live_scores" JSONB,
    "question_index" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_coach_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interview_coach_sessions_user_id_started_at_idx" ON "interview_coach_sessions"("user_id", "started_at");
CREATE INDEX "interview_coach_sessions_user_id_status_idx" ON "interview_coach_sessions"("user_id", "status");

CREATE TABLE "interview_coach_reports" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "readiness" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_coach_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interview_coach_reports_session_id_key" ON "interview_coach_reports"("session_id");
CREATE INDEX "interview_coach_reports_user_id_created_at_idx" ON "interview_coach_reports"("user_id", "created_at");

ALTER TABLE "interview_coach_reports" ADD CONSTRAINT "interview_coach_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_coach_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
