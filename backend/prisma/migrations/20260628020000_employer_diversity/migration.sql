-- Diversity & inclusion (statement + DEI stats) for the public company profile
ALTER TABLE "employer_profiles" ADD COLUMN "diversity_statement" TEXT;
ALTER TABLE "employer_profiles" ADD COLUMN "dei_stats" JSONB NOT NULL DEFAULT '[]';
