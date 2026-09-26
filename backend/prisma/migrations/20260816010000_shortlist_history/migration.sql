-- Makes past sourcing sessions reachable.
--
-- Every search already created a shortlist row carrying the query and each
-- candidate's pipeline stage, but nothing could list them: the work was being
-- stored and then lost to the interface. These two columns are what a history
-- rail needs beyond what was already there.
--
-- `last_opened_at` is separate from `updated_at` on purpose. "Recent" should
-- mean recently *looked at*; updated_at moves whenever a candidate changes
-- stage, which would reorder the list under someone who never opened it.
ALTER TABLE "shortlists"
  ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_opened_at" TIMESTAMP(3);

UPDATE "shortlists" SET "last_opened_at" = "updated_at" WHERE "last_opened_at" IS NULL;

-- Pinned first, then most recently opened — the exact order the rail renders.
CREATE INDEX IF NOT EXISTS "shortlists_employer_pinned_opened_idx"
  ON "shortlists"("employer_id", "pinned", "last_opened_at" DESC);
