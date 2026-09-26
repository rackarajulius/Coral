-- Normalise job status onto the schema's vocabulary.
--
-- The admin panel wrote its own set — 'published', 'flagged', 'suspended',
-- 'rejected', 'pending' — none of which the schema or the public site knows
-- about. Any job an admin touched became invisible everywhere and could not
-- receive applications.
--
-- The schema's statuses are: draft | active | paused | closed | archived.
UPDATE "jobs" SET "status" = 'active'   WHERE "status" = 'published';
UPDATE "jobs" SET "status" = 'draft'    WHERE "status" = 'pending';
-- Flagged is reversible and under review; paused is the schema's word for that.
UPDATE "jobs" SET "status" = 'paused'   WHERE "status" = 'flagged';
-- Suspended is a harder stop than flagged, so it maps to closed, not paused.
UPDATE "jobs" SET "status" = 'closed'   WHERE "status" = 'suspended';
UPDATE "jobs" SET "status" = 'archived' WHERE "status" = 'rejected';

-- Anything still outside the vocabulary is parked as draft rather than left
-- in limbo: invisible either way, but at least in a state the app understands.
UPDATE "jobs" SET "status" = 'draft'
  WHERE "status" NOT IN ('draft', 'active', 'paused', 'closed', 'archived');
