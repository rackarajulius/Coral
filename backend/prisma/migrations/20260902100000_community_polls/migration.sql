-- Polls on community posts.
--
-- The post's text is the question. Votes are unique per (poll, user), which is
-- the constraint the whole result rests on.

ALTER TYPE "PostType" ADD VALUE IF NOT EXISTS 'POLL';

CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "polls_post_id_key" ON "polls"("post_id");
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "poll_options_poll_id_position_idx" ON "poll_options"("poll_id", "position");
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey"
    FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- One vote per person per poll. Per-option would let one account pick
-- everything, which is not a poll.
CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");
CREATE INDEX "poll_votes_option_id_idx" ON "poll_votes"("option_id");

ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_fkey"
    FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_fkey"
    FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
