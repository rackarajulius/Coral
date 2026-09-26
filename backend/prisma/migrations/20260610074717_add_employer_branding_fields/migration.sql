/*
  Warnings:

  - You are about to drop the column `linkedin_company_url` on the `employer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `twitter_company_url` on the `employer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "employer_profiles" DROP COLUMN "linkedin_company_url",
DROP COLUMN "twitter_company_url",
ADD COLUMN     "allow_follow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "company_banner" TEXT,
ADD COLUMN     "founded_year" INTEGER,
ADD COLUMN     "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "locations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "mission" TEXT,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "show_jobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "social_links" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tagline" VARCHAR(160),
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public',
ADD COLUMN     "vision" TEXT;
