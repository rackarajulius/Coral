-- One account, as on LinkedIn: everyone has a personal side, and company
-- powers come from a seat on a company team rather than from the account
-- type. This brings existing employer accounts into that shape.
--
-- Additive only. Nothing is deleted, no role or status changes, and nobody's
-- existing settings are touched. Safe to run twice: every step skips rows it
-- already handled.

-- 1. A personal profile for every employer account that has none.
--
-- Hidden from candidate search. A job seeker's profile starts discoverable,
-- but a recruiter turning up in every other company's search because of a
-- migration would be a surprise; they opt in from their profile if they want
-- to be found. An employer who already has a personal profile keeps it as it
-- is.
INSERT INTO "job_seeker_profiles"
  ("id", "user_id", "jobTypes", "skills", "languages", "skills_normalized",
   "discoverable", "open_to_work", "created_at", "updated_at")
SELECT gen_random_uuid()::text, u."id", '{}', '{}', '{}', '{}',
       false, false, now(), now()
  FROM "users" u
 WHERE u."role" = 'EMPLOYER'
   AND NOT EXISTS (SELECT 1 FROM "job_seeker_profiles" p WHERE p."user_id" = u."id");

-- 2. A real one-person company for every employer account that finished its
--    company step but never created or joined one.
--
-- Until now these ran as an implicit company of one. A real company is what
-- company pages, teams, domains and billing hang off. Only accounts with no
-- membership row at all qualify: someone waiting for approval keeps waiting,
-- and someone suspended or removed is not quietly given a company of their
-- own. Without a company name there is nothing to call it — those accounts
-- finish setup the normal way. "New Company" is the placeholder the app writes
-- for a profile it had to create, not a name anyone chose.
--
-- No domain is claimed. A domain is owned only when proven, and the owner can
-- prove it from their team settings like anyone else.
--
-- The company takes the employer profile's id. That ties each new company to
-- the profile it came from, so the next two steps can find exactly these rows
-- without a temporary table.
INSERT INTO "companies" ("id", "name", "created_at", "updated_at")
SELECT ep."id", btrim(ep."company_name"), now(), now()
  FROM "employer_profiles" ep
  JOIN "users" u ON u."id" = ep."user_id"
 WHERE u."role" = 'EMPLOYER'
   AND ep."company_id" IS NULL
   AND nullif(btrim(ep."company_name"), '') IS NOT NULL
   AND btrim(ep."company_name") <> 'New Company'
   AND NOT EXISTS (SELECT 1 FROM "company_members" m WHERE m."user_id" = u."id")
   AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = ep."id");

-- 3. Its creator owns it.
INSERT INTO "company_members"
  ("id", "company_id", "user_id", "role", "status", "joined_at", "created_at", "updated_at")
SELECT gen_random_uuid()::text, c."id", ep."user_id", 'OWNER', 'ACTIVE', now(), now(), now()
  FROM "companies" c
  JOIN "employer_profiles" ep ON ep."id" = c."id"
 WHERE NOT EXISTS (SELECT 1 FROM "company_members" m WHERE m."user_id" = ep."user_id");

-- 4. And their company page belongs to it.
UPDATE "employer_profiles" ep
   SET "company_id" = ep."id", "updated_at" = now()
 WHERE ep."company_id" IS NULL
   AND EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = ep."id");
