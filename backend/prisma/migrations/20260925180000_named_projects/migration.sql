-- Projects become a thing in their own right, rather than a by-product of
-- searching.
--
-- A shortlist was keyed by its search, so "frontend dev", "frontend developer"
-- and "frontend developer with 2 years of experience in" were three containers
-- for one hiring effort — all three exist in this database right now. A
-- candidate found by two of them became two cards with two stages, which is why
-- the pipeline board has to deduplicate people.
--
-- After this a project can be created and named by hand, and candidates can be
-- moved between projects. `query_key` and `query` become nullable for a project
-- with no search behind it; Postgres treats NULLs as distinct in a unique index,
-- so any number of hand-made projects coexist under the same employer.
ALTER TABLE "shortlists"
    ADD COLUMN "name" VARCHAR(120);

ALTER TABLE "shortlists"
    ALTER COLUMN "query_key" DROP NOT NULL;

ALTER TABLE "shortlists"
    ALTER COLUMN "query" DROP NOT NULL;
