-- Voluntary demographic self-report, for aggregate fairness monitoring of the
-- AI screening scorer.
--
-- Deliberately its own table rather than columns on job_seeker_profiles: every
-- read of a profile happens in candidate-facing and employer-facing code, and
-- this data must never ride along with any of them. Separate table, separate
-- access path, and the only reads are aggregates with a minimum group size.
--
-- Never shown to employers. Never included in any AI prompt. Never returned for
-- an individual to anyone except the person who submitted it.
CREATE TABLE "demographic_self_reports" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  -- All nullable, all self-selected, all with an explicit "prefer not to say".
  "ethnicity"  TEXT,
  "gender"     TEXT,
  "age_band"   TEXT,
  "disability" TEXT,
  "veteran"    TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "demographic_self_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demographic_self_reports_user_id_key"
  ON "demographic_self_reports"("user_id");

-- Deleting the account deletes the report with it.
ALTER TABLE "demographic_self_reports"
  ADD CONSTRAINT "demographic_self_reports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
