-- One lease row per built-in scheduled job, so each runs once per slot no
-- matter how many servers are up. Rows are created by the app on first run.
CREATE TABLE "cron_leases" (
    "name" TEXT NOT NULL,
    "locked_until" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_started_at" TIMESTAMP(3),
    "last_finished_at" TIMESTAMP(3),
    "last_status" TEXT,
    "last_error" TEXT,
    "last_duration_ms" INTEGER,
    "last_ran_by" TEXT,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cron_leases_pkey" PRIMARY KEY ("name")
);
