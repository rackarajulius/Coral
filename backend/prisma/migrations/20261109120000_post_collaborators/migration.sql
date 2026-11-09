-- Collaborators on community posts, as on LinkedIn: people or company pages
-- invited onto a post, who accept or decline.
CREATE TYPE "PostCollaboratorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'LEFT');

CREATE TABLE "post_collaborators" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT,
    "company_id" TEXT,
    "status" "PostCollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_collaborators_pkey" PRIMARY KEY ("id"),
    -- A person or a company, never both and never neither.
    CONSTRAINT "post_collaborators_one_kind" CHECK (("user_id" IS NULL) <> ("company_id" IS NULL))
);

CREATE UNIQUE INDEX "post_collaborators_post_id_user_id_key" ON "post_collaborators"("post_id", "user_id");
CREATE UNIQUE INDEX "post_collaborators_post_id_company_id_key" ON "post_collaborators"("post_id", "company_id");
CREATE INDEX "post_collaborators_user_id_status_idx" ON "post_collaborators"("user_id", "status");
CREATE INDEX "post_collaborators_company_id_status_idx" ON "post_collaborators"("company_id", "status");

ALTER TABLE "post_collaborators" ADD CONSTRAINT "post_collaborators_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_collaborators" ADD CONSTRAINT "post_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_collaborators" ADD CONSTRAINT "post_collaborators_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Whether people may invite you to collaborate. On by default, as on LinkedIn.
ALTER TABLE "users" ADD COLUMN "allow_collaborations" BOOLEAN NOT NULL DEFAULT true;
