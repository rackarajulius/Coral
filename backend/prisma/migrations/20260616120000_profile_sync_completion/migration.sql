-- AlterTable: JobSeekerProfile — availability, contact, extended job preferences
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "open_to_work" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "contact_email" TEXT,
    ADD COLUMN "preferred_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "preferred_industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "willing_to_relocate" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "remote_work" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Experience — verification flag
ALTER TABLE "experiences"
    ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Education — field_of_study now optional, plus gpa/honors/location
ALTER TABLE "educations"
    ALTER COLUMN "field_of_study" DROP NOT NULL,
    ADD COLUMN "location" TEXT,
    ADD COLUMN "gpa" TEXT,
    ADD COLUMN "honors" TEXT;

-- AlterTable: PortfolioItem — media type (video/document/project/design)
ALTER TABLE "portfolio_items"
    ADD COLUMN "media_type" TEXT;

-- CreateTable: Recommendation
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "author_title" TEXT,
    "relationship" TEXT,
    "text" TEXT NOT NULL,
    "date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
