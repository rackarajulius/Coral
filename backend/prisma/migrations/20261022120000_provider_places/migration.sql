-- Where a provider is based, as Coral’s city list reads their free-text
-- city and country on save. The directory’s location filter matches these
-- columns, never the free text. Existing rows are filled by
-- scripts/backfill-provider-places.ts.
ALTER TABLE "freelancer_profiles" ADD COLUMN "place_country_code" TEXT,
ADD COLUMN "place_region" TEXT,
ADD COLUMN "place_city" TEXT;

-- A location search reads country, then province or state, then city.
CREATE INDEX "freelancer_profiles_place_idx" ON "freelancer_profiles"("place_country_code", "place_region", "place_city");
