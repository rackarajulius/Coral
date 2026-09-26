-- A user following a company (profile "Follow" button + new-job alerts)
CREATE TABLE "company_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_follows_user_id_company_id_key" ON "company_follows"("user_id", "company_id");
CREATE INDEX "company_follows_company_id_idx" ON "company_follows"("company_id");
CREATE INDEX "company_follows_user_id_idx" ON "company_follows"("user_id");
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "employer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
