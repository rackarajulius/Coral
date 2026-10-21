-- People following people, beside company_follows.
--
-- The count of rows per following_id is a person's follower count. Deleting
-- either account removes the rows that mention it.
CREATE TABLE "user_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id"),
    -- Following yourself is refused by the service too; this keeps a bug or a
    -- direct write from ever inflating a count that way.
    CONSTRAINT "user_follows_not_self" CHECK ("follower_id" <> "following_id")
);

CREATE UNIQUE INDEX "user_follows_follower_id_following_id_key" ON "user_follows"("follower_id", "following_id");

-- Counting someone's followers reads by following_id.
CREATE INDEX "user_follows_following_id_idx" ON "user_follows"("following_id");

ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
