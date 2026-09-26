-- When the employer first acted on an application — the moment the candidate
-- stopped waiting.
--
-- Deliberately NOT backfilled. `updated_at` records the LAST change, so an
-- application that moved through three stages would report the wait as the time
-- to the third, not the first. Filling this column from it would put estimates
-- and measurements into the same median and make the number untrustworthy for
-- the one thing it exists to be: honest about how long candidates wait.
--
-- Rows written before today stay NULL and are excluded from the statistic. The
-- measure accumulates from here.
ALTER TABLE "applications"
    ADD COLUMN "first_responded_at" TIMESTAMP(3);

-- The responsiveness query filters on this over a rolling window.
CREATE INDEX "applications_first_responded_at_idx"
    ON "applications"("first_responded_at");
