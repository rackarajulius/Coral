-- Quick reactions: a team member's thumbs up or down on a candidate.
--
-- For triage. A hiring manager looking at twenty cards can say "this one" and
-- "not this one" faster than they can write a sentence, and a recruiter sees the
-- shape of the team's opinion at a glance.
--
-- One per person per candidate, changeable and removable: it is a current
-- opinion, not a log of what someone once thought. Company-scoped like notes and
-- tags, and never shown to the candidate.
CREATE TYPE "CandidateReactionValue" AS ENUM ('UP', 'DOWN');

CREATE TABLE "candidate_reactions" (
    "id"           TEXT NOT NULL,
    "company_id"   TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "value"        "CandidateReactionValue" NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_reactions_pkey" PRIMARY KEY ("id")
);

-- One current opinion per person, which is what makes this a vote rather than a
-- comment thread.
CREATE UNIQUE INDEX "candidate_reactions_company_id_candidate_id_user_id_key"
    ON "candidate_reactions"("company_id", "candidate_id", "user_id");

CREATE INDEX "candidate_reactions_company_id_candidate_id_idx"
    ON "candidate_reactions"("company_id", "candidate_id");

ALTER TABLE "candidate_reactions"
    ADD CONSTRAINT "candidate_reactions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_reactions"
    ADD CONSTRAINT "candidate_reactions_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cascade, unlike candidate_notes which keeps an author's name: a note's content
-- still means something after its author leaves, but a tally should not count
-- votes from people who are gone.
ALTER TABLE "candidate_reactions"
    ADD CONSTRAINT "candidate_reactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
