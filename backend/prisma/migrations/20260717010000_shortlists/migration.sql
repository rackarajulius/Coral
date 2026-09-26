-- Hiring-assistant shortlists: a persistent, curated pipeline per search.
CREATE TABLE "shortlists" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "query_key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "role_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shortlists_employer_id_query_key_key" ON "shortlists"("employer_id", "query_key");
CREATE INDEX "shortlists_employer_id_updated_at_idx" ON "shortlists"("employer_id", "updated_at");

CREATE TABLE "shortlist_items" (
    "id" TEXT NOT NULL,
    "shortlist_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "stage" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shortlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shortlist_items_shortlist_id_candidate_id_key" ON "shortlist_items"("shortlist_id", "candidate_id");
CREATE INDEX "shortlist_items_shortlist_id_idx" ON "shortlist_items"("shortlist_id");

ALTER TABLE "shortlist_items" ADD CONSTRAINT "shortlist_items_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "shortlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
