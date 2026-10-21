-- What a posting states about itself: whether the role is open now, and
-- whether AI screens applicants (both required in Ontario postings since
-- 2026-01-01). Unstated vacancy is NULL, not false.
ALTER TABLE "jobs" ADD COLUMN "existing_vacancy" BOOLEAN;
ALTER TABLE "jobs" ADD COLUMN "uses_ai" BOOLEAN NOT NULL DEFAULT false;
