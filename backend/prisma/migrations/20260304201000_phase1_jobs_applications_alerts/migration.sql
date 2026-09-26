-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "posted_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "employment_type" TEXT NOT NULL,
    "experience_level" TEXT,
    "location" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "is_hybrid" BOOLEAN NOT NULL DEFAULT false,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" TEXT NOT NULL DEFAULT 'USD',
    "salary_period" TEXT,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "application_deadline" TIMESTAMP(3),
    "max_applicants" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "applications_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "cover_letter" TEXT,
    "resume_url" TEXT,
    "expected_salary" INTEGER,
    "availability_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stage" TEXT,
    "notes" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "job_type" TEXT,
    "experience_level" TEXT,
    "salary_min" INTEGER,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_posted_by_id_created_at_idx" ON "jobs"("posted_by_id", "created_at");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_idx" ON "jobs"("status", "published_at");

-- CreateIndex
CREATE INDEX "jobs_employment_type_created_at_idx" ON "jobs"("employment_type", "created_at");

-- CreateIndex
CREATE INDEX "jobs_experience_level_created_at_idx" ON "jobs"("experience_level", "created_at");

-- CreateIndex
CREATE INDEX "jobs_location_idx" ON "jobs"("location");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_id_applicant_id_key" ON "applications"("job_id", "applicant_id");

-- CreateIndex
CREATE INDEX "applications_job_id_applied_at_idx" ON "applications"("job_id", "applied_at");

-- CreateIndex
CREATE INDEX "applications_applicant_id_applied_at_idx" ON "applications"("applicant_id", "applied_at");

-- CreateIndex
CREATE INDEX "applications_status_applied_at_idx" ON "applications"("status", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_jobs_user_id_job_id_key" ON "saved_jobs"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "saved_jobs_user_id_created_at_idx" ON "saved_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_jobs_job_id_idx" ON "saved_jobs"("job_id");

-- CreateIndex
CREATE INDEX "job_alerts_user_id_created_at_idx" ON "job_alerts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "job_alerts_is_active_frequency_last_sent_at_idx" ON "job_alerts"("is_active", "frequency", "last_sent_at");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
