-- A deactivated company page can be deleted for good, 30 days after its owner asks.
ALTER TABLE "companies" ADD COLUMN "deletes_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "deletion_requested_by_id" TEXT;
CREATE INDEX "companies_deletes_at_idx" ON "companies"("deletes_at");
