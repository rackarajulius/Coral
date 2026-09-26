-- Companies, membership and invitations.
--
-- Until now "the company" was a loose string on employer_profiles — sometimes a
-- website domain, sometimes an email domain, sometimes another profile's UUID.
-- Anything keyed to it was therefore a guess, and onboarding would let anyone
-- with a matching email domain attach themselves to an existing company with no
-- approval from the people already in it. Once company membership decides who
-- can read applications and CVs, that stops being untidy and becomes a hole.
--
-- After this migration `employer_profiles.company_id` is a real foreign key,
-- and joining a company requires either an invitation or an approval.

CREATE TYPE "CompanyRole" AS ENUM (
  'OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'
);

-- PENDING is someone who asked to join on a matching domain and holds no
-- access whatsoever until approved.
CREATE TYPE "CompanyMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "companies" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "domain"     VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

CREATE TABLE "company_members" (
  "id"            TEXT NOT NULL,
  "company_id"    TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "role"          "CompanyRole" NOT NULL DEFAULT 'RECRUITER',
  "status"        "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invited_by_id" TEXT,
  "joined_at"     TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_members_company_id_user_id_key"
  ON "company_members"("company_id", "user_id");
CREATE INDEX "company_members_user_id_idx" ON "company_members"("user_id");
CREATE INDEX "company_members_company_id_status_idx"
  ON "company_members"("company_id", "status");

CREATE TABLE "company_invitations" (
  "id"             TEXT NOT NULL,
  "company_id"     TEXT NOT NULL,
  "email"          VARCHAR(255) NOT NULL,
  "role"           "CompanyRole" NOT NULL DEFAULT 'RECRUITER',
  "token_hash"     TEXT NOT NULL,
  "status"         "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by_id"  TEXT NOT NULL,
  "expires_at"     TIMESTAMP(3) NOT NULL,
  "accepted_at"    TIMESTAMP(3),
  "accepted_by_id" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_invitations_token_hash_key"
  ON "company_invitations"("token_hash");
CREATE INDEX "company_invitations_company_id_status_idx"
  ON "company_invitations"("company_id", "status");
CREATE INDEX "company_invitations_email_idx" ON "company_invitations"("email");

-- One live invitation per address per company. Partial, so revoked and accepted
-- rows accumulate as history without blocking a fresh invite. Prisma cannot
-- express a partial unique index, so it is not mirrored in schema.prisma.
CREATE UNIQUE INDEX "company_invitations_one_pending_per_email"
  ON "company_invitations"("company_id", lower("email"))
  WHERE "status" = 'PENDING';

ALTER TABLE "company_members"
  ADD CONSTRAINT "company_members_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_members"
  ADD CONSTRAINT "company_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_invitations"
  ADD CONSTRAINT "company_invitations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing company_id values were domain strings, never company ids. Clearing
-- them first keeps the foreign key below from failing on legacy data; every row
-- gets a real company in the backfill that follows.
UPDATE "employer_profiles"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

ALTER TABLE "employer_profiles"
  ADD CONSTRAINT "employer_profiles_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing employer becomes the OWNER of their own company, so
-- nobody loses access and the public page (the owner's profile) is unchanged.
DO $$
DECLARE
  p RECORD;
  new_company_id TEXT;
BEGIN
  FOR p IN
    SELECT id, user_id, company_name FROM "employer_profiles" WHERE "company_id" IS NULL
  LOOP
    new_company_id := gen_random_uuid()::text;

    INSERT INTO "companies" ("id", "name", "created_at", "updated_at")
    VALUES (
      new_company_id,
      COALESCE(NULLIF(btrim(p.company_name), ''), 'My company'),
      now(),
      now()
    );

    UPDATE "employer_profiles" SET "company_id" = new_company_id WHERE "id" = p.id;

    INSERT INTO "company_members"
      ("id", "company_id", "user_id", "role", "status", "joined_at", "created_at", "updated_at")
    VALUES
      (gen_random_uuid()::text, new_company_id, p.user_id, 'OWNER', 'ACTIVE', now(), now(), now())
    ON CONFLICT ("company_id", "user_id") DO NOTHING;
  END LOOP;
END $$;
