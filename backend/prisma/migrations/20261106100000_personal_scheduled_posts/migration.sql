-- A scheduled post can be in its author's own name: no company.
ALTER TABLE "scheduled_posts" ALTER COLUMN "company_id" DROP NOT NULL;

-- A person's own queue.
CREATE INDEX "scheduled_posts_author_id_status_publish_at_idx" ON "scheduled_posts"("author_id", "status", "publish_at");
