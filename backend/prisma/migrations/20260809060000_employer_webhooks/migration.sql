-- Outbound webhooks: the universal ATS integration primitive.
--
-- Native connectors (Greenhouse, Lever, Ashby, Workday) each need partner
-- credentials and a live tenant to build against. A signed webhook needs
-- neither and is consumable by every ATS, every iPaaS (Zapier, Make, n8n) and
-- any middleware a customer already runs.
CREATE TABLE "employer_webhooks" (
  "id"          TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  -- HMAC-SHA256 key. Receivers verify the X-Coral-Signature header so a
  -- third party cannot forge screening results into someone's ATS.
  "secret"      TEXT NOT NULL,
  -- Event names this endpoint wants, e.g. {"screening.completed"}.
  "events"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active"      BOOLEAN NOT NULL DEFAULT true,
  -- Last delivery outcome, so a silently broken endpoint is visible in the UI
  -- rather than discovered weeks later.
  "last_status"     INTEGER,
  "last_error"      TEXT,
  "last_attempt_at" TIMESTAMP(3),
  "failure_count"   INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employer_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employer_webhooks_employer_id_idx" ON "employer_webhooks"("employer_id");

ALTER TABLE "employer_webhooks"
  ADD CONSTRAINT "employer_webhooks_employer_id_fkey"
  FOREIGN KEY ("employer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
