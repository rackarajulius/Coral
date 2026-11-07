-- Scheduled company posts, and post views for post stats.

-- A company post written now and published at a set time. Kept apart from
-- "posts" until it goes out, so nothing that reads posts has to skip it.
CREATE TYPE "ScheduledPostStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "publish_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "post_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scheduled_posts_post_id_key" ON "scheduled_posts"("post_id");
-- The publishing job asks for what is due; a page asks for its own queue.
CREATE INDEX "scheduled_posts_status_publish_at_idx" ON "scheduled_posts"("status", "publish_at");
CREATE INDEX "scheduled_posts_company_id_status_publish_at_idx"
    ON "scheduled_posts"("company_id", "status", "publish_at");

ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Someone had a post on screen: one row per post, person and UTC day. Only
-- counts are ever read out. The total survives pruning in posts.views_count.
ALTER TABLE "posts" ADD COLUMN "views_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "post_views" (
    "post_id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    CONSTRAINT "post_views_pkey" PRIMARY KEY ("post_id", "viewer_id", "day")
);

CREATE INDEX "post_views_post_id_day_idx" ON "post_views"("post_id", "day");
-- Supports the nightly prune of anything past the stats window.
CREATE INDEX "post_views_day_idx" ON "post_views"("day");

ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_viewer_id_fkey"
    FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
