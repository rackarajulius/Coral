-- LinkedIn-style domain ownership: a company's domain is set only once
-- someone has proven control of it, and records when, how and by whom.
ALTER TABLE "companies" ADD COLUMN "domain_verified_at" TIMESTAMP(3),
ADD COLUMN "domain_verified_method" TEXT,
ADD COLUMN "domain_verified_by_id" TEXT;

-- Domains being proven: a DNS TXT token, or an emailed code (hashed).
CREATE TABLE "company_domain_claims" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "method" TEXT NOT NULL,
    "dns_token" TEXT,
    "email" TEXT,
    "code_hash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "company_domain_claims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_domain_claims_method_check" CHECK ("method" IN ('dns', 'email'))
);

CREATE INDEX "company_domain_claims_company_id_created_at_idx" ON "company_domain_claims"("company_id", "created_at");

ALTER TABLE "company_domain_claims" ADD CONSTRAINT "company_domain_claims_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domains set before this were taken from a typed website or the creator's
-- email, never proven. Keep one only where an active owner or admin signs in
-- with a verified address at it — that is proof — and record it as such.
UPDATE "companies" AS c
SET "domain_verified_at" = now(), "domain_verified_method" = 'sign-in',
    "domain_verified_by_id" = (
      SELECT m."user_id" FROM "company_members" m JOIN "users" u ON u."id" = m."user_id"
      WHERE m."company_id" = c."id" AND m."status" = 'ACTIVE' AND m."role" IN ('OWNER', 'ADMIN')
        AND u."email_verified" AND lower(split_part(u."email", '@', 2)) = c."domain"
      ORDER BY m."created_at" LIMIT 1)
WHERE c."domain" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "company_members" m JOIN "users" u ON u."id" = m."user_id"
  WHERE m."company_id" = c."id" AND m."status" = 'ACTIVE' AND m."role" IN ('OWNER', 'ADMIN')
    AND u."email_verified" AND lower(split_part(u."email", '@', 2)) = c."domain");

-- The rest were never shown to belong to the company: an owner proves them again.
UPDATE "companies" SET "domain" = NULL WHERE "domain" IS NOT NULL AND "domain_verified_at" IS NULL;
