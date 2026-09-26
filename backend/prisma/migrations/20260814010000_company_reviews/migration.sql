-- Company reviews, scoped to verified hiring interactions.
--
-- A review must be tied to a real Application or Interview with that employer.
-- That is the whole trust model: there is no "claim you worked here" path, so
-- fabricated reviews would require fabricating an application first, and each
-- interaction yields at most one review.
--
-- Reviewers are anonymous to the employer and identified to the platform.
-- author_id is never exposed through any employer-facing endpoint.
CREATE TABLE "company_reviews" (
  "id"              TEXT NOT NULL,
  "employer_id"     TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  -- Exactly one of these is set; the unique indexes below cap it at one review
  -- per interaction.
  "application_id"  TEXT,
  "interview_id"    TEXT,
  -- How far the reviewer actually got, so readers can weigh the review.
  "stage_reached"   TEXT NOT NULL,
  "rating"          INTEGER NOT NULL,
  -- { communication, clarity, respect, timeliness } — all 1-5, all optional.
  "category_ratings" JSONB,
  "title"           TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  -- pending (queued for a human) | published | removed
  "status"          TEXT NOT NULL DEFAULT 'pending',
  -- What the automated checks found. Kept even when published, so a later
  -- complaint can be judged against what we knew at the time.
  "check_results"   JSONB,
  "moderation_note" TEXT,
  "published_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_reviews_application_id_key" ON "company_reviews"("application_id");
CREATE UNIQUE INDEX "company_reviews_interview_id_key"  ON "company_reviews"("interview_id");
CREATE INDEX "company_reviews_employer_id_status_idx"   ON "company_reviews"("employer_id", "status");
CREATE INDEX "company_reviews_author_id_idx"            ON "company_reviews"("author_id");
CREATE INDEX "company_reviews_status_created_at_idx"    ON "company_reviews"("status", "created_at");

ALTER TABLE "company_reviews"
  ADD CONSTRAINT "company_reviews_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Employer right of REPLY. Deliberately no delete path for the employer: they
-- can flag a review for moderation, never remove it.
CREATE TABLE "review_responses" (
  "id"           TEXT NOT NULL,
  "review_id"    TEXT NOT NULL,
  "employer_id"  TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_responses_review_id_key" ON "review_responses"("review_id");

ALTER TABLE "review_responses"
  ADD CONSTRAINT "review_responses_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "company_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Anyone can report a review; resolution is an admin action.
CREATE TABLE "review_flags" (
  "id"          TEXT NOT NULL,
  "review_id"   TEXT NOT NULL,
  "reporterId"  TEXT NOT NULL,
  "reason"      TEXT NOT NULL,
  "detail"      TEXT,
  "resolved_at" TIMESTAMP(3),
  "outcome"     TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_flags_review_id_idx"   ON "review_flags"("review_id");
CREATE INDEX "review_flags_resolved_at_idx" ON "review_flags"("resolved_at");

ALTER TABLE "review_flags"
  ADD CONSTRAINT "review_flags_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "company_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
