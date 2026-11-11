-- Reporting a person from their community page, beside reporting a post or a
-- comment. Reviewed by platform admins only.
ALTER TABLE "post_reports" ADD COLUMN "person_id" TEXT;

CREATE UNIQUE INDEX "post_reports_person_id_reporter_id_key" ON "post_reports"("person_id", "reporter_id");

ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
