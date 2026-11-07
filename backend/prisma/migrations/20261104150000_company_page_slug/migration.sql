-- A company page's own address, /company/<slug>, as on LinkedIn.

ALTER TABLE "employer_profiles" ADD COLUMN "slug" VARCHAR(100);

CREATE UNIQUE INDEX "employer_profiles_slug_key" ON "employer_profiles"("slug");

-- Every existing company page gets one from its name, by the rules in
-- company/page-slug.ts: lowercase, anything else becomes a hyphen, no doubled
-- or edge hyphens, at least one letter. The oldest page keeps the plain name;
-- later ones with the same name get -2, -3. A name with no usable letters
-- gets no slug and stays reachable by its id.
WITH pages AS (
  SELECT
    ep."id",
    ep."created_at",
    NULLIF(
      left(trim(BOTH '-' FROM regexp_replace(lower(ep."company_name"), '[^a-z0-9]+', '-', 'g')), 90),
      ''
    ) AS base
  FROM "employer_profiles" ep
  WHERE EXISTS (SELECT 1 FROM "companies" c WHERE c."page_id" = ep."id")
),
usable AS (
  SELECT "id", "created_at",
    CASE WHEN base ~ '[a-z]' THEN trim(BOTH '-' FROM base) ELSE NULL END AS base
  FROM pages
),
ranked AS (
  SELECT "id", base, row_number() OVER (PARTITION BY base ORDER BY "created_at") AS n
  FROM usable
  WHERE base IS NOT NULL AND base NOT IN ('new', 'setup', 'admin', 'edit', 'settings')
)
UPDATE "employer_profiles" ep
SET "slug" = CASE WHEN r.n = 1 THEN r.base ELSE r.base || '-' || r.n END
FROM ranked r
WHERE ep."id" = r."id";
