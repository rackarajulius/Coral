-- Spaces someone closed in "Suggested spaces", so they are not offered again.
CREATE TABLE "space_suggestion_dismissals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_suggestion_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "space_suggestion_dismissals_user_id_space_id_key" ON "space_suggestion_dismissals"("user_id", "space_id");
CREATE INDEX "space_suggestion_dismissals_space_id_idx" ON "space_suggestion_dismissals"("space_id");

ALTER TABLE "space_suggestion_dismissals" ADD CONSTRAINT "space_suggestion_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "space_suggestion_dismissals" ADD CONSTRAINT "space_suggestion_dismissals_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
