-- Who may comment on a community post: anyone (as before), followers only,
-- or nobody. Every existing post keeps today's behaviour through the default.
CREATE TYPE "CommentPolicy" AS ENUM ('ANYONE', 'FOLLOWERS', 'OFF');

ALTER TABLE "posts" ADD COLUMN "comment_policy" "CommentPolicy" NOT NULL DEFAULT 'ANYONE';
