-- A shareable link that admits its holder to a company.
--
-- Kept separate from company_invitations on purpose. That table addresses one
-- person: `email` is NOT NULL and a partial unique index enforces one live
-- invitation per address, which is the right rule for an invitation and the
-- wrong one for a link (two link rows carrying a placeholder address would
-- collide with each other).
--
-- The token is stored in the clear, unlike an invitation token. A link that
-- cannot be displayed again is not a shareable link, so re-display is a
-- requirement rather than a convenience; the containment comes from the domain
-- lock, the role ceiling and expiry, not from the token being secret at rest.

CREATE TABLE "company_join_links" (
  "id"            TEXT NOT NULL,
  "company_id"    TEXT NOT NULL,
  "token"         TEXT NOT NULL,
  "role"          "CompanyRole" NOT NULL DEFAULT 'RECRUITER',
  "domain_locked" BOOLEAN NOT NULL DEFAULT true,
  "max_uses"      INTEGER,
  "used_count"    INTEGER NOT NULL DEFAULT 0,
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "revoked_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_join_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_join_links_token_key" ON "company_join_links"("token");
CREATE INDEX "company_join_links_company_id_idx" ON "company_join_links"("company_id");

-- One live link per company. Regenerating revokes the previous one, so an
-- escaped link always has exactly one remedy and no ambiguity about which link
-- is current. Revoked rows accumulate as history.
CREATE UNIQUE INDEX "company_join_links_one_live_per_company"
  ON "company_join_links"("company_id")
  WHERE "revoked_at" IS NULL;

-- Defence in depth behind the service check: a link must never mint an owner or
-- an admin, whatever calls the database.
ALTER TABLE "company_join_links"
  ADD CONSTRAINT "company_join_links_role_not_privileged"
  CHECK ("role" NOT IN ('OWNER', 'ADMIN'));

ALTER TABLE "company_join_links"
  ADD CONSTRAINT "company_join_links_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
