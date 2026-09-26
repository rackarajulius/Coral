-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('JOB_SEEKER', 'EMPLOYER', 'FREELANCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_ONBOARDING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabase_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'JOB_SEEKER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_seeker_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "current_title" TEXT,
    "current_company" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "remote_preference" TEXT,
    "jobTypes" TEXT[],
    "experience_level" TEXT,
    "salary_expectation" TEXT,
    "available_from" TIMESTAMP(3),
    "skills" TEXT[],
    "languages" TEXT[],
    "linkedin_url" TEXT,
    "github_url" TEXT,
    "portfolio_url" TEXT,
    "twitter_url" TEXT,
    "resume_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_seeker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "company_logo" TEXT,
    "location" TEXT,
    "employment_type" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educations" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "institution_logo" TEXT,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_org" TEXT NOT NULL,
    "issuing_org_logo" TEXT,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "no_expiration" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "project_url" TEXT,
    "image_url" TEXT,
    "video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "company_name" TEXT NOT NULL,
    "company_logo" TEXT,
    "company_website" TEXT,
    "company_size" TEXT,
    "industry" TEXT,
    "job_title" TEXT NOT NULL,
    "department" TEXT,
    "is_hiring_manager" BOOLEAN NOT NULL DEFAULT false,
    "is_recruiter" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "company_description" TEXT,
    "company_benefits" TEXT[],
    "company_culture" TEXT,
    "headquarters" TEXT,
    "company_locations" TEXT[],
    "linkedin_company_url" TEXT,
    "twitter_company_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelancer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "title" TEXT,
    "skills" TEXT[],
    "expertise" TEXT[],
    "hourly_rate" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "available_for_remote" BOOLEAN NOT NULL DEFAULT true,
    "availability" TEXT,
    "hours_per_week" INTEGER,
    "portfolio_url" TEXT,
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "completed_projects" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "total_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "job_seeker_profiles_user_id_key" ON "job_seeker_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_profiles_user_id_key" ON "employer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_profiles_user_id_key" ON "freelancer_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "job_seeker_profiles" ADD CONSTRAINT "job_seeker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_profiles" ADD CONSTRAINT "employer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
