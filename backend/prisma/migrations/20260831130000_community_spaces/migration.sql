-- Spaces: posts belong to a place rather than to one global river.
--
-- posts.space_id is nullable because posts predate this. There are none in
-- practice, but making it NOT NULL would still mean choosing a space on behalf
-- of anyone who did post, and the service sets it on every new post anyway.

CREATE TYPE "SpaceKind" AS ENUM ('TOPIC', 'COMPANY');
CREATE TYPE "SpaceMemberRole" AS ENUM ('MEMBER', 'MODERATOR');

CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "kind" "SpaceKind" NOT NULL DEFAULT 'TOPIC',
    "company_id" TEXT,
    "allow_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spaces_slug_key" ON "spaces"("slug");
CREATE INDEX "spaces_kind_archived_at_idx" ON "spaces"("kind", "archived_at");
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "space_members" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "SpaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "space_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "space_members_space_id_user_id_key" ON "space_members"("space_id", "user_id");
CREATE INDEX "space_members_user_id_idx" ON "space_members"("user_id");
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_fkey"
    FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts" ADD COLUMN "space_id" TEXT;
CREATE INDEX "posts_space_id_created_at_idx" ON "posts"("space_id", "created_at");
ALTER TABLE "posts" ADD CONSTRAINT "posts_space_id_fkey"
    FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A curated starting set. Spaces are not user-creatable yet: at this size,
-- open creation produces many empty rooms, and an empty room is the thing
-- spaces exist to avoid.
INSERT INTO "spaces" ("id", "slug", "name", "description", "kind", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'introductions', 'Introductions', 'New here? Say what you do and what you are looking for.', 'TOPIC', NOW(), NOW()),
  (gen_random_uuid(), 'job-search', 'Job Search', 'Applications, interviews, offers, and everything between.', 'TOPIC', NOW(), NOW()),
  (gen_random_uuid(), 'hiring', 'Hiring', 'For the people doing the hiring — sourcing, screening, process.', 'TOPIC', NOW(), NOW()),
  (gen_random_uuid(), 'careers', 'Career Growth', 'Skills, promotions, changing direction.', 'TOPIC', NOW(), NOW()),
  (gen_random_uuid(), 'ask-an-employer', 'Ask an Employer', 'Questions for the people on the other side of the table.', 'TOPIC', NOW(), NOW());
