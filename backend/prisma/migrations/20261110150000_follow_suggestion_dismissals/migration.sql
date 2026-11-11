-- People and company pages someone closed in "Who to follow" or
-- "Professionals for you", so they are not offered again.
CREATE TABLE "follow_suggestion_dismissals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_suggestion_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "follow_suggestion_dismissals_user_id_kind_target_id_key" ON "follow_suggestion_dismissals"("user_id", "kind", "target_id");

ALTER TABLE "follow_suggestion_dismissals" ADD CONSTRAINT "follow_suggestion_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
