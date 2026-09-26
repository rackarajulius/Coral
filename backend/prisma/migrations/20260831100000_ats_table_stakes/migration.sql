-- ATS primitives that were missing: candidate notes, tags, offers, and
-- reusable candidate email templates.
--
-- Application.notes is left in place rather than migrated: it is a single
-- overwritable blob with no author, so its contents cannot be attributed to
-- anyone. Copying it into authored notes would invent an author.

CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

CREATE TABLE "candidate_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "candidate_notes_company_id_candidate_id_created_at_idx"
    ON "candidate_notes"("company_id", "candidate_id", "created_at");
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "candidate_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidate_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "candidate_tags_company_id_candidate_id_label_key"
    ON "candidate_tags"("company_id", "candidate_id", "label");
CREATE INDEX "candidate_tags_company_id_label_idx" ON "candidate_tags"("company_id", "label");
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "salary_amount" INTEGER,
    "salary_currency" TEXT NOT NULL DEFAULT 'cad',
    "salary_period" TEXT,
    "start_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "message" TEXT,
    "internal_notes" TEXT,
    "created_by_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "offers_application_id_key" ON "offers"("application_id");
CREATE INDEX "offers_company_id_status_idx" ON "offers"("company_id", "status");
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_templates_company_id_name_key" ON "email_templates"("company_id", "name");
CREATE INDEX "email_templates_company_id_category_idx" ON "email_templates"("company_id", "category");
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
