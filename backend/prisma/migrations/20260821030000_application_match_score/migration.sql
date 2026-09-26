-- Stores the applicant/job skill match instead of recomputing it per request.
--
-- It was derived in application code on every fetch, which meant it could not
-- be ordered by in SQL. The candidates board therefore pulled the 200 most
-- recent applications and sorted them in the browser: "top applicants" was
-- really "top of the most recent 200", and quietly stopped being true for any
-- employer past that.
--
-- NULL means the job lists no skills — there is nothing to compare against.
-- That is deliberately distinct from 0, which means "compared, matched none",
-- and the UI renders NULL as an em dash rather than a zero.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "match_score" INTEGER;

-- The board's query: one job's applicants, best first. NULLS LAST matches the
-- ordering the service asks for, so the index covers it rather than being
-- ignored for a sort.
CREATE INDEX IF NOT EXISTS "applications_job_match_score_idx"
  ON "applications"("job_id", "match_score" DESC NULLS LAST);

-- Backfill, mirroring computeMatchScore exactly:
--   * both sides trimmed, lowercased, blanks dropped
--   * bidirectional substring — "react" matches "react.js" and vice versa
--   * NULL when the job lists no usable skills; 0 when the candidate lists none
--
-- position() is used rather than LIKE so that '%' or '_' inside a skill name is
-- matched literally instead of behaving as a wildcard.
UPDATE "applications" a
SET "match_score" = sub.score
FROM (
  SELECT
    a2.id,
    CASE
      WHEN jw.wanted IS NULL OR cardinality(jw.wanted) = 0 THEN NULL
      WHEN ph.held IS NULL OR cardinality(ph.held) = 0 THEN 0
      ELSE round(
        100.0 * (
          SELECT count(*)
          FROM unnest(jw.wanted) AS w
          WHERE EXISTS (
            SELECT 1 FROM unnest(ph.held) AS h
            WHERE position(w in h) > 0 OR position(h in w) > 0
          )
        ) / cardinality(jw.wanted)
      )
    END AS score
  FROM "applications" a2
  JOIN "jobs" j ON j.id = a2.job_id
  LEFT JOIN "job_seeker_profiles" p ON p.user_id = a2.applicant_id
  CROSS JOIN LATERAL (
    SELECT array_agg(t) FILTER (WHERE t <> '') AS wanted
    FROM unnest(COALESCE(j.skills, ARRAY[]::text[])) AS s(raw),
         LATERAL (SELECT lower(btrim(s.raw))) AS n(t)
  ) jw
  CROSS JOIN LATERAL (
    SELECT array_agg(t) FILTER (WHERE t <> '') AS held
    FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) AS s(raw),
         LATERAL (SELECT lower(btrim(s.raw))) AS n(t)
  ) ph
) sub
WHERE a.id = sub.id;
