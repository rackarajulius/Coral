-- Organization type and LinkedIn's size bands on company pages.

ALTER TABLE "employer_profiles" ADD COLUMN "company_type" VARCHAR(40);

-- Sizes were written by three different forms: plain hyphens, en dashes
-- ("201–500") and no thousands separators. Bring the ones that mean exactly
-- one of LinkedIn's bands onto it. A range that spans two bands ("1-10" is
-- 0-1 or 2-10; "1000+" is any band from 1,001 up) is left as it is: guessing
-- would put a number on a page that its owner never chose.
UPDATE "employer_profiles"
SET "company_size" = translate(trim("company_size"), '–—', '--')
WHERE "company_size" IS NOT NULL AND "company_size" <> translate(trim("company_size"), '–—', '--');

UPDATE "employer_profiles" SET "company_size" = '501-1,000' WHERE "company_size" = '501-1000';
UPDATE "employer_profiles" SET "company_size" = '1,001-5,000' WHERE "company_size" = '1001-5000';
UPDATE "employer_profiles" SET "company_size" = '5,001-10,000' WHERE "company_size" = '5001-10000';
UPDATE "employer_profiles" SET "company_size" = '10,001+' WHERE "company_size" = '10001+';
