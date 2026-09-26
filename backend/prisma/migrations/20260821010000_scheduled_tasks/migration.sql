-- Recurring tasks an employer configures for themselves.
--
-- The platform already runs crons (job expiry warnings, archiving), but they
-- are hardcoded and nobody can change them. This makes the same machinery
-- configurable, without handing anyone a cron expression to get wrong.
--
-- Due work is found by querying next_run_at, not by registering jobs at
-- runtime: an in-memory job vanishes on restart and runs twice the moment a
-- second instance starts. A stored timestamp plus a claim survives both.

CREATE TYPE "ScheduledTaskType" AS ENUM (
  'STALE_APPLICATIONS', 'INTERVIEWS_WITHOUT_OUTCOME', 'WEEKLY_SUMMARY'
);

CREATE TYPE "TaskCadence" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY');

CREATE TABLE "scheduled_tasks" (
  "id"                TEXT NOT NULL,
  "company_id"        TEXT NOT NULL,
  "created_by_id"     TEXT NOT NULL,
  "type"              "ScheduledTaskType" NOT NULL,
  "config_key"        TEXT NOT NULL DEFAULT '',
  "config"            JSONB NOT NULL DEFAULT '{}',
  "cadence"           "TaskCadence" NOT NULL DEFAULT 'WEEKLY',
  "hour_local"        INTEGER NOT NULL DEFAULT 9,
  "weekday"           INTEGER,
  -- Without a per-task zone every task fires at server time, which is nobody's
  -- 9am. Captured from the creator's browser, per task rather than per user so
  -- a recruiter hiring across regions can differ per job.
  "timezone"          TEXT NOT NULL DEFAULT 'UTC',
  "enabled"           BOOLEAN NOT NULL DEFAULT true,
  "notify_when_empty" BOOLEAN NOT NULL DEFAULT false,
  "last_run_at"       TIMESTAMP(3),
  "next_run_at"       TIMESTAMP(3) NOT NULL,
  "last_summary"      TEXT,
  "claimed_at"        TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- config_key is part of the key so the singleton kinds stay one-per-company
-- while a future saved-search watcher can key on its shortlist id.
CREATE UNIQUE INDEX "scheduled_tasks_company_type_config_key"
  ON "scheduled_tasks"("company_id", "type", "config_key");

-- The sweeper's only query.
CREATE INDEX "scheduled_tasks_enabled_next_run_idx"
  ON "scheduled_tasks"("enabled", "next_run_at");

ALTER TABLE "scheduled_tasks"
  ADD CONSTRAINT "scheduled_tasks_hour_range" CHECK ("hour_local" BETWEEN 0 AND 23);
ALTER TABLE "scheduled_tasks"
  ADD CONSTRAINT "scheduled_tasks_weekday_range"
  CHECK ("weekday" IS NULL OR "weekday" BETWEEN 1 AND 7);

ALTER TABLE "scheduled_tasks"
  ADD CONSTRAINT "scheduled_tasks_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
