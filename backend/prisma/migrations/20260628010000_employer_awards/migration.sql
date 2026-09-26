-- Awards & accreditations for the public company profile
ALTER TABLE "employer_profiles" ADD COLUMN "awards" JSONB NOT NULL DEFAULT '[]';
