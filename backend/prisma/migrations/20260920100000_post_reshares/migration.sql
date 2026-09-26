-- Passing on someone else's post, with or without your own words on top.
--
-- The mechanism for "official company voice + authentic human voice": a
-- company publishes, its people pass it on in their own name, and the badge
-- already says who they are.

ALTER TABLE "posts"
    ADD COLUMN "reshared_from_id" TEXT,
    ADD COLUMN "reshares_count" INTEGER NOT NULL DEFAULT 0;

-- CASCADE, not SET NULL. Author deletion here is a hard delete, and someone
-- asking for their words to be removed should not find them still being read
-- inside someone else's post. The resharer's own commentary goes with it,
-- which is the lesser cost.
ALTER TABLE "posts" ADD CONSTRAINT "posts_reshared_from_id_fkey"
    FOREIGN KEY ("reshared_from_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "posts_reshared_from_id_idx" ON "posts"("reshared_from_id");
