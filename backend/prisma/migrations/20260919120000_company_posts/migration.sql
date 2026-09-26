-- Posts that speak for a company rather than for the person who wrote them.
--
-- The author is still recorded. Hiding who actually posted would make the
-- company page a place where nobody is accountable for anything said on it,
-- and in a hiring context that is exactly backwards.
--
-- SET NULL rather than CASCADE on company deletion: the post was still written
-- and still has an author, so it reverts to being theirs rather than vanishing.
ALTER TABLE "posts"
    ADD COLUMN "company_id" TEXT;

ALTER TABLE "posts" ADD CONSTRAINT "posts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The company page asks for its own posts, newest first.
CREATE INDEX "posts_company_id_created_at_idx" ON "posts"("company_id", "created_at");
