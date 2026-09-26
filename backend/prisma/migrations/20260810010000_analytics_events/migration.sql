-- Employer analytics event capture.
--
-- Job.viewsCount is a running total with no time dimension, so no trend can be
-- derived from it, and the top of the hiring funnel (profile views, job views,
-- apply clicks, apply starts) was never recorded at all. None of that can be
-- reconstructed after the fact — this table has to exist before the data
-- matters, which is why it ships ahead of any chart that reads it.
CREATE TABLE "analytics_events" (
  "id"           TEXT NOT NULL,
  -- Always resolved server-side from the job or profile being viewed, never
  -- taken from the client: otherwise anyone could inflate anyone's numbers.
  "employer_id"  TEXT NOT NULL,
  "job_id"       TEXT,
  "type"         TEXT NOT NULL, -- profile_view | job_view | apply_click | apply_started
  "occurred_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Salted hash of (ip + user agent + UTC day). Lets us count unique visitors
  -- and drop duplicates WITHOUT storing an IP. The salt includes the day, so
  -- the same person is not linkable across days even if the salt leaks.
  "session_hash" TEXT,
  -- Set only when the viewer was signed in, so an employer's own visits to
  -- their job can be excluded from their stats.
  "viewer_id"    TEXT,
  -- Referrer host only (e.g. "linkedin.com"), never a full URL — full referrers
  -- carry search terms and private path segments.
  "source"       TEXT,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_employer_id_occurred_at_idx"
  ON "analytics_events"("employer_id", "occurred_at");
CREATE INDEX "analytics_events_job_id_occurred_at_idx"
  ON "analytics_events"("job_id", "occurred_at");
-- Drives the nightly rollup, which scans one day at a time.
CREATE INDEX "analytics_events_occurred_at_idx"
  ON "analytics_events"("occurred_at");

-- Nightly rollup. Charts read these pre-aggregated rows rather than scanning
-- raw events, and raw events can then be pruned without losing the history.
CREATE TABLE "employer_metrics_daily" (
  "id"              TEXT NOT NULL,
  "employer_id"     TEXT NOT NULL,
  "day"             DATE NOT NULL,
  "profile_views"   INTEGER NOT NULL DEFAULT 0,
  "job_views"       INTEGER NOT NULL DEFAULT 0,
  "apply_clicks"    INTEGER NOT NULL DEFAULT 0,
  "apply_started"   INTEGER NOT NULL DEFAULT 0,
  "unique_visitors" INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employer_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- Submitted applications are NOT rolled up here: Application.appliedAt already
-- carries the time dimension, so counting them live keeps one source of truth
-- and removes any chance of the rollup disagreeing with the pipeline.
CREATE UNIQUE INDEX "employer_metrics_daily_employer_id_day_key"
  ON "employer_metrics_daily"("employer_id", "day");
CREATE INDEX "employer_metrics_daily_employer_id_day_idx"
  ON "employer_metrics_daily"("employer_id", "day");
