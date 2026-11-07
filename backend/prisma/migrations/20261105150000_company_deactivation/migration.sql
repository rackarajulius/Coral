-- A company page can be taken down and brought back, as on LinkedIn.
ALTER TABLE "companies" ADD COLUMN "deactivated_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "deactivated_by_id" TEXT;
