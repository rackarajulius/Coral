-- Jobs whose applicants Coral's AI already screened have to say AI is used:
-- from now on the first scored screen sets it, and this covers screens sent
-- before. Written and live rounds are scored by AI; video answers are judged
-- by the employer, so they don't count.
UPDATE "jobs" SET "uses_ai" = true
WHERE "uses_ai" = false
  AND EXISTS (
    SELECT 1 FROM "ai_screens" s
    WHERE s."job_id" = "jobs"."id" AND s."mode" IN ('text', 'live')
  );
