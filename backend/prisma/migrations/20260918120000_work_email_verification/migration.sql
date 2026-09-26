-- Work-email verification: proving employment by receiving a code at the
-- company's own domain. Free per check, unlike an ID provider.

-- The domain that was actually proved. Kept separately from `verified` because
-- the two claims differ: `verified` says "this person worked at this employer",
-- which we may only assert when the domain can be tied to that employer. The
-- domain alone is still true, and still worth showing.
ALTER TABLE "experiences"
    ADD COLUMN "verified_work_domain" VARCHAR(255);

CREATE TABLE "work_email_verifications" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "experience_id" TEXT NOT NULL,
    "email"         VARCHAR(255) NOT NULL,
    "domain"        VARCHAR(255) NOT NULL,
    -- SHA-256 of the code. The code itself only ever exists in the email.
    "code_hash"     TEXT NOT NULL,
    "attempts"      INTEGER NOT NULL DEFAULT 0,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "consumed_at"   TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_email_verifications_pkey" PRIMARY KEY ("id")
);

-- Both halves of the send rate limit read this.
CREATE INDEX "work_email_verifications_user_id_created_at_idx"
    ON "work_email_verifications"("user_id", "created_at");

CREATE INDEX "work_email_verifications_experience_id_idx"
    ON "work_email_verifications"("experience_id");

ALTER TABLE "work_email_verifications" ADD CONSTRAINT "work_email_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_email_verifications" ADD CONSTRAINT "work_email_verifications_experience_id_fkey"
    FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
