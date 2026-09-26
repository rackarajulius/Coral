-- Structured, per-reviewer interview scorecards.
--
-- Interview.feedback is left in place. It held one scorecard per interview, so
-- on a panel it already lost everyone but the last writer; migrating it would
-- attribute those surviving words to a reviewer we cannot identify.

CREATE TYPE "ScorecardRecommendation" AS ENUM ('STRONG_YES', 'YES', 'NO', 'STRONG_NO');

CREATE TABLE "scorecard_criteria" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scorecard_criteria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scorecard_criteria_company_id_label_key" ON "scorecard_criteria"("company_id", "label");
CREATE INDEX "scorecard_criteria_company_id_position_idx" ON "scorecard_criteria"("company_id", "position");
ALTER TABLE "scorecard_criteria" ADD CONSTRAINT "scorecard_criteria_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "scorecards" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "reviewer_name" TEXT NOT NULL,
    "recommendation" "ScorecardRecommendation",
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scorecards_interview_id_reviewer_id_key" ON "scorecards"("interview_id", "reviewer_id");
CREATE INDEX "scorecards_interview_id_idx" ON "scorecards"("interview_id");
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_interview_id_fkey"
    FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "scorecard_ratings" (
    "id" TEXT NOT NULL,
    "scorecard_id" TEXT NOT NULL,
    "criterion" VARCHAR(60) NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "scorecard_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scorecard_ratings_scorecard_id_criterion_key" ON "scorecard_ratings"("scorecard_id", "criterion");
ALTER TABLE "scorecard_ratings" ADD CONSTRAINT "scorecard_ratings_scorecard_id_fkey"
    FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
