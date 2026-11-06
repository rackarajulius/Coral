-- Professionals a client saved to come back to. Private to the person who
-- saved them. Deleting either account removes the rows that mention it.
CREATE TABLE "saved_professionals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_professionals_pkey" PRIMARY KEY ("id"),
    -- Saving yourself is refused by the service too.
    CONSTRAINT "saved_professionals_not_self" CHECK ("user_id" <> "professional_id")
);

CREATE UNIQUE INDEX "saved_professionals_user_id_professional_id_key" ON "saved_professionals"("user_id", "professional_id");

-- A person's list, newest first.
CREATE INDEX "saved_professionals_user_id_created_at_idx" ON "saved_professionals"("user_id", "created_at");

CREATE INDEX "saved_professionals_professional_id_idx" ON "saved_professionals"("professional_id");

ALTER TABLE "saved_professionals" ADD CONSTRAINT "saved_professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_professionals" ADD CONSTRAINT "saved_professionals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The list is private, so it isn't left to anything but the API. With no
-- policies, Supabase's public keys can't read or write it; the API connects as
-- the table's owner, which row-level security doesn't apply to.
ALTER TABLE "saved_professionals" ENABLE ROW LEVEL SECURITY;
