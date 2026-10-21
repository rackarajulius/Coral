-- Job matches a seeker marked "not interested", so the matcher stops showing them.
CREATE TABLE "dismissed_matches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dismissed_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dismissed_matches_user_id_job_id_key" ON "dismissed_matches"("user_id", "job_id");
CREATE INDEX "dismissed_matches_user_id_created_at_idx" ON "dismissed_matches"("user_id", "created_at");

ALTER TABLE "dismissed_matches" ADD CONSTRAINT "dismissed_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
