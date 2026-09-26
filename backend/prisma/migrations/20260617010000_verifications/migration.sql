-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('IDENTITY', 'WORK_ELIGIBILITY', 'EXPERIENCE', 'EDUCATION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "target_id" TEXT,
    "document_url" TEXT,
    "note" TEXT,
    "reviewer_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verifications_user_id_idx" ON "verifications"("user_id");

-- CreateIndex
CREATE INDEX "verifications_status_idx" ON "verifications"("status");

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
