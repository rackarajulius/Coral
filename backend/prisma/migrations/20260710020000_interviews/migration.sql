-- Employer <-> candidate interview scheduling (hiring agent Phase 3).
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "role" TEXT,
    "medium" TEXT NOT NULL DEFAULT 'video',
    "location" TEXT,
    "meeting_link" TEXT,
    "proposed_slots" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "interviews_employer_id_created_at_idx" ON "interviews"("employer_id", "created_at");
CREATE INDEX "interviews_candidate_id_status_idx" ON "interviews"("candidate_id", "status");
