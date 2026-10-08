CREATE TABLE "external_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "applied_at" TIMESTAMP(3),
    "follow_up_at" TIMESTAMP(3),
    "reminded_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_applications_user_id_source_key_key" ON "external_applications"("user_id", "source_key");
CREATE INDEX "external_applications_user_id_updated_at_idx" ON "external_applications"("user_id", "updated_at");
CREATE INDEX "external_applications_user_id_follow_up_at_idx" ON "external_applications"("user_id", "follow_up_at");
CREATE INDEX "external_applications_reminded_at_follow_up_at_idx" ON "external_applications"("reminded_at", "follow_up_at");
ALTER TABLE "external_applications" ADD CONSTRAINT "external_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
