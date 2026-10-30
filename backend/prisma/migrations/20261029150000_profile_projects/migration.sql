-- Projects on a job seeker's profile: dates, skills, a link, pictures and a
-- video, and the job or service each was done in.
CREATE TABLE "profile_projects" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "start_date" DATE,
    "end_date" DATE,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "project_url" VARCHAR(2048),
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience_id" TEXT,
    "service_listing_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profile_projects_profile_id_idx" ON "profile_projects"("profile_id");
CREATE INDEX "profile_projects_service_listing_id_idx" ON "profile_projects"("service_listing_id");

ALTER TABLE "profile_projects" ADD CONSTRAINT "profile_projects_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_projects" ADD CONSTRAINT "profile_projects_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profile_projects" ADD CONSTRAINT "profile_projects_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
