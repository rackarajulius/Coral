-- Core values for the public company profile (list of { title, description, icon? })
ALTER TABLE "employer_profiles" ADD COLUMN "core_values" JSONB NOT NULL DEFAULT '[]';
