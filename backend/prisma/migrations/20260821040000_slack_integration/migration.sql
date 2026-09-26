-- Slack, connected per company rather than per person.
--
-- Google Calendar is per-user because a calendar belongs to a recruiter. A
-- Slack channel belongs to the team, so one connection serves everyone and
-- does not vanish when the person who set it up leaves.
--
-- Stores an incoming-webhook URL rather than a bot token: Slack binds it to the
-- channel chosen during install, it never expires, and it cannot read anything.
-- A bot token would be a far larger grant for the one thing we do — post.
CREATE TABLE "slack_integrations" (
  "id"             TEXT NOT NULL,
  "company_id"     TEXT NOT NULL,
  "webhook_url"    TEXT NOT NULL,
  "channel_name"   TEXT,
  "team_name"      TEXT,
  "connected_by_id" TEXT NOT NULL,
  "last_error"     TEXT,
  "last_posted_at" TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- One workspace per company. Reconnecting replaces it rather than accumulating
-- endpoints nobody remembers configuring.
CREATE UNIQUE INDEX "slack_integrations_company_id_key"
  ON "slack_integrations"("company_id");

ALTER TABLE "slack_integrations"
  ADD CONSTRAINT "slack_integrations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
