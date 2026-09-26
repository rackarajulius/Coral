-- Self-serve booking: employer-published open time slots.
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "role" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER NOT NULL DEFAULT 30,
    "medium" TEXT NOT NULL DEFAULT 'video',
    "status" TEXT NOT NULL DEFAULT 'open',
    "interview_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "availability_slots_employer_id_start_at_idx" ON "availability_slots"("employer_id", "start_at");

CREATE INDEX "availability_slots_status_start_at_idx" ON "availability_slots"("status", "start_at");
