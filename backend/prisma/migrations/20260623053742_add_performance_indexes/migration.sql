-- DropIndex
DROP INDEX "posts_author_id_idx";

-- CreateIndex
CREATE INDEX "applications_stage_applied_at_idx" ON "applications"("stage", "applied_at");

-- CreateIndex
CREATE INDEX "employer_profiles_user_id_idx" ON "employer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "employer_profiles_verification_status_idx" ON "employer_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "employer_profiles_created_at_idx" ON "employer_profiles"("created_at");

-- CreateIndex
CREATE INDEX "freelancer_profiles_user_id_idx" ON "freelancer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "freelancer_profiles_created_at_idx" ON "freelancer_profiles"("created_at");

-- CreateIndex
CREATE INDEX "job_alerts_user_id_is_active_idx" ON "job_alerts"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "job_seeker_profiles_user_id_idx" ON "job_seeker_profiles"("user_id");

-- CreateIndex
CREATE INDEX "job_seeker_profiles_created_at_idx" ON "job_seeker_profiles"("created_at");

-- CreateIndex
CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "jobs_featured_created_at_idx" ON "jobs"("featured", "created_at");

-- CreateIndex
CREATE INDEX "jobs_is_remote_created_at_idx" ON "jobs"("is_remote", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_post_type_created_at_idx" ON "posts"("post_type", "created_at");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_role_created_at_idx" ON "users"("role", "created_at");

-- CreateIndex
CREATE INDEX "verifications_type_status_idx" ON "verifications"("type", "status");

-- CreateIndex
CREATE INDEX "verifications_created_at_idx" ON "verifications"("created_at");
