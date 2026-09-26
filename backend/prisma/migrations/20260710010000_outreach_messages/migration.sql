-- Employer -> candidate recruiting outreach log (hiring agent Phase 2).
CREATE TABLE "outreach_messages" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "role" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'notification',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outreach_messages_employer_id_created_at_idx" ON "outreach_messages"("employer_id", "created_at");
CREATE INDEX "outreach_messages_candidate_id_created_at_idx" ON "outreach_messages"("candidate_id", "created_at");
