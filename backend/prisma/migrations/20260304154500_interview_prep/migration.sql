-- CreateTable
CREATE TABLE "interview_prep_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_role" TEXT NOT NULL,
    "company" TEXT,
    "interview_type" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "job_description" TEXT,
    "focus_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "question_count" INTEGER NOT NULL DEFAULT 8,
    "profile_snapshot" JSONB NOT NULL,
    "generated_plan" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_prep_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_prep_feedback" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_prep_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_prep_sessions_user_id_created_at_idx" ON "interview_prep_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_prep_feedback_session_id_created_at_idx" ON "interview_prep_feedback"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_prep_feedback_user_id_created_at_idx" ON "interview_prep_feedback"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "interview_prep_sessions" ADD CONSTRAINT "interview_prep_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_prep_feedback" ADD CONSTRAINT "interview_prep_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_prep_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_prep_feedback" ADD CONSTRAINT "interview_prep_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
