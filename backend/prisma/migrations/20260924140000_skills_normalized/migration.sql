-- A lower-cased mirror of `skills`, so candidate search can match them.
--
-- Postgres array containment is case-sensitive and Prisma exposes no
-- `mode: "insensitive"` for it, so `skills @> ARRAY['react']` never matched the
-- "React" that profiles actually store. Skills are the strongest signal in
-- candidate search, and that branch of the query was finding nobody.
--
-- `skills` keeps the capitalisation people typed — it is what gets displayed.
-- This column exists only to be searched, and is maintained alongside it in
-- JobSeekersService.updateMyProfile.
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "skills_normalized" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from what is already there, so existing profiles are findable
-- immediately rather than only after their owner next saves.
UPDATE "job_seeker_profiles"
   SET "skills_normalized" = ARRAY(SELECT lower(s) FROM unnest("skills") AS s)
 WHERE array_length("skills", 1) IS NOT NULL;

-- GIN is the index for array containment; the default B-tree cannot serve it.
CREATE INDEX "job_seeker_profiles_skills_normalized_idx"
    ON "job_seeker_profiles" USING GIN ("skills_normalized");
