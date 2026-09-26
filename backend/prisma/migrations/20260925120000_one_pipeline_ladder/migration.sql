-- One pipeline ladder, whichever way a candidate arrived.
--
-- Sourced candidates ran new→contacted→screening→interview→offer and could
-- never be marked hired or rejected. Applicants ran off `applications.status`.
-- The same hire therefore looked different depending on which board you opened,
-- and a person who was sourced and then applied became two unconnected cards.
--
-- `applications.status` stays the stored truth for applicants; the shared stage
-- is derived from it (see src/common/pipeline-stage.ts). Only the sourcing side
-- changes shape here.
CREATE TYPE "PipelineStage" AS ENUM (
    'SOURCED',
    'CONTACTED',
    'APPLIED',
    'SCREENING',
    'INTERVIEW',
    'OFFER',
    'HIRED',
    'REJECTED',
    'WITHDRAWN'
);

-- Converted in place rather than dropped and re-added, so any existing card
-- keeps its position. 'new' becomes SOURCED because that is what it meant:
-- found, not yet approached. Anything unrecognised becomes NULL (saved only)
-- rather than guessing a rung for it.
ALTER TABLE "shortlist_items"
    ALTER COLUMN "stage" TYPE "PipelineStage"
    USING (
        CASE lower("stage")
            WHEN 'new'       THEN 'SOURCED'
            WHEN 'contacted' THEN 'CONTACTED'
            WHEN 'applied'   THEN 'APPLIED'
            WHEN 'screening' THEN 'SCREENING'
            WHEN 'interview' THEN 'INTERVIEW'
            WHEN 'offer'     THEN 'OFFER'
            WHEN 'hired'     THEN 'HIRED'
            WHEN 'rejected'  THEN 'REJECTED'
            ELSE NULL
        END::"PipelineStage"
    );

-- The link that makes the two pipelines meet. Unique: one application belongs
-- to at most one sourcing record.
ALTER TABLE "shortlist_items"
    ADD COLUMN "application_id" TEXT;

ALTER TABLE "shortlist_items"
    ADD CONSTRAINT "shortlist_items_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "shortlist_items_application_id_key"
    ON "shortlist_items"("application_id");

-- Looking a candidate up across shortlists is how the link gets made on apply.
CREATE INDEX "shortlist_items_candidate_id_idx"
    ON "shortlist_items"("candidate_id");
