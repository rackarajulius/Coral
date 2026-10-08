-- CreateEnum
CREATE TYPE "PostPurpose" AS ENUM ('GENERAL', 'QUESTION', 'SHOWCASE', 'SERVICE_ANNOUNCEMENT', 'OPPORTUNITY');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "linked_gig_id" TEXT,
ADD COLUMN     "linked_job_id" TEXT,
ADD COLUMN     "linked_service_listing_id" TEXT,
ADD COLUMN     "purpose" "PostPurpose" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "service_listings" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "title" VARCHAR(160) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'design',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalized_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "work_samples" JSONB NOT NULL DEFAULT '[]',
    "availability" TEXT NOT NULL DEFAULT 'available',
    "work_mode" TEXT NOT NULL DEFAULT 'remote',
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "city" TEXT,
    "pricing_mode" TEXT NOT NULL DEFAULT 'quote',
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "amount_minor" INTEGER,
    "public_consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "removed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_briefs" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "title" VARCHAR(160) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'design',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalized_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "work_mode" TEXT NOT NULL DEFAULT 'remote',
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "city" TEXT,
    "budget_mode" TEXT NOT NULL DEFAULT 'negotiable',
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "min_budget_minor" INTEGER,
    "max_budget_minor" INTEGER,
    "deadline" TIMESTAMP(3),
    "public_consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "removed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "service_listing_id" TEXT,
    "project_brief_id" TEXT,
    "reason" TEXT NOT NULL,
    "details" VARCHAR(1000),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_listings_owner_user_id_created_at_idx" ON "service_listings"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "service_listings_company_id_created_at_idx" ON "service_listings"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "service_listings_status_category_created_at_idx" ON "service_listings"("status", "category", "created_at");

-- CreateIndex
CREATE INDEX "service_listings_normalized_skills_idx" ON "service_listings" USING GIN ("normalized_skills");

-- CreateIndex
CREATE INDEX "project_briefs_owner_user_id_created_at_idx" ON "project_briefs"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "project_briefs_company_id_created_at_idx" ON "project_briefs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "project_briefs_status_category_created_at_idx" ON "project_briefs"("status", "category", "created_at");

-- CreateIndex
CREATE INDEX "project_briefs_normalized_skills_idx" ON "project_briefs" USING GIN ("normalized_skills");

-- CreateIndex
CREATE INDEX "marketplace_reports_created_at_idx" ON "marketplace_reports"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reports_reporter_id_service_listing_id_key" ON "marketplace_reports"("reporter_id", "service_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reports_reporter_id_project_brief_id_key" ON "marketplace_reports"("reporter_id", "project_brief_id");

-- CreateIndex
CREATE INDEX "posts_purpose_created_at_idx" ON "posts"("purpose", "created_at");

-- CreateIndex
CREATE INDEX "posts_linked_service_listing_id_idx" ON "posts"("linked_service_listing_id");

-- CreateIndex
CREATE INDEX "posts_linked_gig_id_idx" ON "posts"("linked_gig_id");

-- CreateIndex
CREATE INDEX "posts_linked_job_id_idx" ON "posts"("linked_job_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_linked_service_listing_id_fkey" FOREIGN KEY ("linked_service_listing_id") REFERENCES "service_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_linked_gig_id_fkey" FOREIGN KEY ("linked_gig_id") REFERENCES "project_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_linked_job_id_fkey" FOREIGN KEY ("linked_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_project_brief_id_fkey" FOREIGN KEY ("project_brief_id") REFERENCES "project_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A canonical announcement has at most one target. Deletion may clear it.
ALTER TABLE "posts" ADD CONSTRAINT "posts_one_marketplace_reference_check"
CHECK (num_nonnulls("linked_service_listing_id", "linked_gig_id", "linked_job_id") <= 1);

-- Reports always address exactly one listing, including after retries.
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_one_target_check"
CHECK (num_nonnulls("service_listing_id", "project_brief_id") = 1);

ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_status_check"
CHECK ("status" IN ('open', 'reviewed'));

ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_amount_check"
CHECK ("amount_minor" IS NULL OR "amount_minor" BETWEEN 1 AND 1000000000);

ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_budget_check"
CHECK (("min_budget_minor" IS NULL OR "min_budget_minor" BETWEEN 1 AND 1000000000)
AND ("max_budget_minor" IS NULL OR "max_budget_minor" BETWEEN 1 AND 1000000000)
AND ("min_budget_minor" IS NULL OR "max_budget_minor" IS NULL OR "min_budget_minor" <= "max_budget_minor"));
