-- Tides: something happening at a time — a webinar, a careers fair, an open
-- day, an hour with the team. Named rather than borrowed: a tide happens
-- whether or not you are there, and you catch it or you miss it.

CREATE TYPE "TideMode" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');
CREATE TYPE "TideRsvp" AS ENUM ('GOING', 'INTERESTED');

ALTER TYPE "PostType" ADD VALUE 'TIDE';

CREATE TABLE "tides" (
    "id"            TEXT NOT NULL,
    "title"         VARCHAR(140) NOT NULL,
    "description"   TEXT,
    "company_id"    TEXT,
    "host_id"       TEXT NOT NULL,
    "starts_at"     TIMESTAMP(3) NOT NULL,
    "ends_at"       TIMESTAMP(3),
    -- The IANA zone the host chose. Stored beside the instant, not instead of
    -- it: "2pm" is not a time until you know where, and a reader elsewhere
    -- needs both the host's clock and their own.
    "timezone"      VARCHAR(64) NOT NULL,
    "mode"          "TideMode" NOT NULL DEFAULT 'ONLINE',
    "location"      VARCHAR(255),
    -- Never served in a public listing. Handed out only to people who said
    -- they are coming: a meeting link anyone can read is an open door.
    "join_url"      VARCHAR(2048),
    "banner_url"    TEXT,
    "capacity"      INTEGER,
    "canceled_at"   TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tide_attendees" (
    "id"         TEXT NOT NULL,
    "tide_id"    TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "status"     "TideRsvp" NOT NULL DEFAULT 'GOING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tide_attendees_pkey" PRIMARY KEY ("id")
);

-- The listing is always "what is coming up", so time leads.
CREATE INDEX "tides_starts_at_idx" ON "tides"("starts_at");
CREATE INDEX "tides_company_id_starts_at_idx" ON "tides"("company_id", "starts_at");

-- One answer per person; changing your mind updates it.
CREATE UNIQUE INDEX "tide_attendees_tide_id_user_id_key" ON "tide_attendees"("tide_id", "user_id");
CREATE INDEX "tide_attendees_user_id_idx" ON "tide_attendees"("user_id");

ALTER TABLE "tides" ADD CONSTRAINT "tides_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tides" ADD CONSTRAINT "tides_host_id_fkey"
    FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tide_attendees" ADD CONSTRAINT "tide_attendees_tide_id_fkey"
    FOREIGN KEY ("tide_id") REFERENCES "tides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tide_attendees" ADD CONSTRAINT "tide_attendees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A post is how a tide reaches the feed, so it inherits comments, likes and
-- resharing instead of needing its own. SET NULL: deleting a tide should not
-- silently delete the announcement someone wrote about it.
ALTER TABLE "posts" ADD COLUMN "tide_id" TEXT;
ALTER TABLE "posts" ADD CONSTRAINT "posts_tide_id_fkey"
    FOREIGN KEY ("tide_id") REFERENCES "tides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "posts_tide_id_idx" ON "posts"("tide_id");
