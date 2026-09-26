-- Moderation: reports, and soft removal of posts and comments.
--
-- Removal is soft on purpose. A hard delete leaves nothing to review, so a
-- disputed decision cannot be checked and a pattern of bad-faith reporting
-- cannot be seen.

CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

ALTER TABLE "posts" ADD COLUMN "removed_at" TIMESTAMP(3);
ALTER TABLE "posts" ADD COLUMN "removed_by_id" TEXT;
ALTER TABLE "posts" ADD COLUMN "removal_reason" TEXT;

ALTER TABLE "post_comments" ADD COLUMN "removed_at" TIMESTAMP(3);
ALTER TABLE "post_comments" ADD COLUMN "removed_by_id" TEXT;

CREATE TABLE "post_reports" (
    "id" TEXT NOT NULL,
    "post_id" TEXT,
    "comment_id" TEXT,
    "reporter_id" TEXT NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_reports_pkey" PRIMARY KEY ("id")
);

-- One person, one report per item: reporting twice is the same concern, not a
-- stronger one, and counting it twice would let one account inflate a queue.
CREATE UNIQUE INDEX "post_reports_post_id_reporter_id_key" ON "post_reports"("post_id", "reporter_id");
CREATE UNIQUE INDEX "post_reports_comment_id_reporter_id_key" ON "post_reports"("comment_id", "reporter_id");
CREATE INDEX "post_reports_status_created_at_idx" ON "post_reports"("status", "created_at");

ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ranking reads these together on every feed page.
CREATE INDEX "posts_removed_at_created_at_idx" ON "posts"("removed_at", "created_at");
