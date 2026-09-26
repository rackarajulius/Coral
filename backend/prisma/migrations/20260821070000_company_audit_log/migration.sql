-- Who did what, inside a company.
--
-- Deliberately separate from audit_logs, which records platform governance by
-- staff. These are tenant records with a different audience, different access
-- rules and different retention; one table would need a company_id IS NULL
-- discriminator on every read forever, and would leave a column named admin_id
-- holding recruiter ids.
--
-- Written at the time of the action, never derived afterwards: a row only holds
-- its current state, so "who changed this role" is unanswerable from the data
-- itself, and deletions leave no trace at all.

CREATE TYPE "CompanyAuditCategory" AS ENUM (
  'TEAM', 'JOBS', 'CANDIDATES', 'INTEGRATIONS', 'COMPANY'
);

CREATE TABLE "company_audit_logs" (
  "id"          TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  -- Nullable and SET NULL on delete, with the name kept alongside: an audit
  -- entry whose actor has since been removed must still say who did it.
  "actor_id"    TEXT,
  "actor_name"  TEXT NOT NULL,
  "category"    "CompanyAuditCategory" NOT NULL,
  "action"      TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id"   TEXT,
  -- Never a candidate's name. This log has a CSV export, so anything written
  -- here leaves the app and stops being covered by access checks.
  "entity_name" TEXT,
  "summary"     TEXT NOT NULL,
  "before"      JSONB,
  "after"       JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_audit_logs_pkey" PRIMARY KEY ("id")
);

-- The viewer's two queries: everything newest-first, and one category.
CREATE INDEX "company_audit_logs_company_created_idx"
  ON "company_audit_logs"("company_id", "created_at" DESC);
CREATE INDEX "company_audit_logs_company_category_created_idx"
  ON "company_audit_logs"("company_id", "category", "created_at" DESC);

ALTER TABLE "company_audit_logs"
  ADD CONSTRAINT "company_audit_logs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_audit_logs"
  ADD CONSTRAINT "company_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
