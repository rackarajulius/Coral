-- One page per company, as on LinkedIn.
--
-- EmployerProfile is one row per person, so a company with several members
-- had several copies of "its page": an admin's edits went to their own row,
-- and each recruiter's jobs showed their own copy. Company.page_id names the
-- one profile that is the company's page; everything company-facing reads it.

ALTER TABLE "companies" ADD COLUMN "page_id" TEXT;

CREATE UNIQUE INDEX "companies_page_id_key" ON "companies"("page_id");

ALTER TABLE "companies" ADD CONSTRAINT "companies_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "employer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each existing company's page is the profile its community links, post logos
-- and badges already resolved to: the oldest linked profile that isn't
-- private, else the oldest linked profile at all. Followers and reviews were
-- gathered there, so the page stays where people found it.
UPDATE "companies" c
SET "page_id" = (
  SELECT ep."id"
  FROM "employer_profiles" ep
  WHERE ep."company_id" = c."id"
  ORDER BY (ep."visibility" = 'private') ASC, ep."created_at" ASC
  LIMIT 1
)
WHERE c."page_id" IS NULL;
