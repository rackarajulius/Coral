-- When a request's recipient first answered it: accepted, declined or
-- replied. A provider's profile says how they reply to requests from this.
ALTER TABLE "marketplace_requests" ADD COLUMN "recipient_responded_at" TIMESTAMP(3);

-- Existing requests, from times that were measured: accepting, or the first
-- reply (which also accepts). Declines made before this column have no time
-- of their own, so they stay NULL: still counted as answered, never timed.
UPDATE "marketplace_requests"
SET "recipient_responded_at" = LEAST("accepted_at", "first_recipient_reply_at")
WHERE "accepted_at" IS NOT NULL OR "first_recipient_reply_at" IS NOT NULL;
