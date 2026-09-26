-- "Why work here" EVP cards for the public company profile
ALTER TABLE "employer_profiles" ADD COLUMN "why_work_here" JSONB NOT NULL DEFAULT '[]';
