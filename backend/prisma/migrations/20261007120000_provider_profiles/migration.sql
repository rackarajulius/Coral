-- Add personal provider capability without changing any User role or hiring data.
ALTER TABLE "freelancer_profiles"
  ADD COLUMN "provider_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_preview_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "work_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve legacy freelancer eligibility, while requiring new public consent.
UPDATE "freelancer_profiles" AS profile
SET "provider_enabled" = true
FROM "users" AS account
WHERE profile."user_id" = account."id" AND account."role" = 'FREELANCER';

CREATE INDEX "freelancer_provider_public_category_id_idx"
  ON "freelancer_profiles"("provider_enabled", "public_preview_enabled", "category", "id");
