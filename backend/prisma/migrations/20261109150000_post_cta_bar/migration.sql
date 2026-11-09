-- A call-to-action bar on community posts, as on LinkedIn's sponsored posts:
-- a headline, a link and a button from a fixed list; and its clicks, counted
-- once per person per day the way views are.
CREATE TYPE "PostCtaLabel" AS ENUM ('LEARN_MORE', 'APPLY', 'BOOK_NOW', 'BUY_NOW', 'SHOP_NOW', 'SIGN_UP', 'REGISTER', 'DOWNLOAD', 'CONTACT_US', 'GET_QUOTE', 'REQUEST_DEMO', 'SUBSCRIBE', 'JOIN', 'ATTEND');

ALTER TABLE "posts" ADD COLUMN "cta_label" "PostCtaLabel",
ADD COLUMN "cta_url" VARCHAR(2000),
ADD COLUMN "cta_headline" VARCHAR(200),
ADD COLUMN "cta_clicks_count" INTEGER NOT NULL DEFAULT 0,
-- All three or none: a button with nowhere to go, or a link with no words, is not a bar.
ADD CONSTRAINT "posts_cta_complete" CHECK (
  ("cta_label" IS NULL AND "cta_url" IS NULL AND "cta_headline" IS NULL) OR
  ("cta_label" IS NOT NULL AND "cta_url" IS NOT NULL AND "cta_headline" IS NOT NULL)
);

CREATE TABLE "post_cta_clicks" (
    "post_id" TEXT NOT NULL,
    "clicker_id" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "post_cta_clicks_pkey" PRIMARY KEY ("post_id", "clicker_id", "day")
);

CREATE INDEX "post_cta_clicks_day_idx" ON "post_cta_clicks"("day");

ALTER TABLE "post_cta_clicks" ADD CONSTRAINT "post_cta_clicks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_cta_clicks" ADD CONSTRAINT "post_cta_clicks_clicker_id_fkey" FOREIGN KEY ("clicker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
