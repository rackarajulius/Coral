-- Drops `applications.stage`, a third stage vocabulary nobody read.
--
-- It held "Application Sent" or "Withdrawn", was written on every apply, was
-- filterable, and was aggregated into a `stageBreakdown` that no screen ever
-- displayed. Worse, the candidate board's stage filter queried THIS column
-- while the UI sent the stage names it derives from `status` — so picking any
-- stage chip matched nothing and emptied the board.
--
-- The pipeline stage is derived from `applications.status` instead, through the
-- one shared ladder in src/common/pipeline-stage.ts.
--
-- Checked before dropping: no frontend code reads it, no webhook or integration
-- serialises it, there is no OpenAPI surface, and no export includes it. It was
-- present in API responses only because Prisma returns whole rows.
DROP INDEX IF EXISTS "applications_stage_applied_at_idx";

ALTER TABLE "applications" DROP COLUMN IF EXISTS "stage";
