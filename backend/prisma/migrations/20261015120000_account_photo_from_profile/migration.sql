-- A job seeker's uploaded photo was saved on the profile only, while posts,
-- comments, chat and every other page read the account's photo. Uploads now
-- write both; this brings the photos uploaded before that into line.
UPDATE "users" AS u
SET "avatar_url" = j."avatar_url"
FROM "job_seeker_profiles" AS j
WHERE j."user_id" = u."id"
  AND j."avatar_url" IS NOT NULL
  AND u."avatar_url" IS DISTINCT FROM j."avatar_url";
