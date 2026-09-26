-- Employer-initiated async AI screening interviews (hiring agent Phase 4).
CREATE TABLE "ai_screens" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "role" TEXT,
    "job_description" TEXT,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "evaluation" JSONB,
    "overall_score" INTEGER,
    "recommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_screens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_screens_employer_id_created_at_idx" ON "ai_screens"("employer_id", "created_at");
CREATE INDEX "ai_screens_candidate_id_status_idx" ON "ai_screens"("candidate_id", "status");
