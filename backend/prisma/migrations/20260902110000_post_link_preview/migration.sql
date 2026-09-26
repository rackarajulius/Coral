-- The unfurled card for the first link in a post, captured when it was written.
--
-- Stored rather than resolved on every read: a preview fetched at read time
-- can differ per reader, costs a request per render, and lets a page change
-- after a moderator has already looked at the post.
ALTER TABLE "posts" ADD COLUMN "link_preview" JSONB;
