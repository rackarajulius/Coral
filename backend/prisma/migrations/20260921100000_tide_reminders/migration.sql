-- The "starts soon" reminder, which is the thing that actually gets people to
-- turn up. It fires when the join window opens, an hour before the start, so
-- the message and the way in arrive together.

-- One stamp for the whole tide, not one per attendee: someone who says they
-- are coming after it fired has just looked at it and does not need telling.
ALTER TABLE "tides"
    ADD COLUMN "reminded_at" TIMESTAMP(3);

-- The sweep asks the same question every few minutes: starting soon, not yet
-- told. Without this it is a full scan of the table each time.
CREATE INDEX "tides_reminded_at_starts_at_idx" ON "tides"("reminded_at", "starts_at");
