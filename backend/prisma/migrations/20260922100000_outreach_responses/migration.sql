-- Outreach responses.
--
-- Outreach was one-way: an in-app notification and an email, with no way to
-- answer and nothing recorded afterwards. `status` defaulted to 'sent' and was
-- never updated, so there were no open rates, no reply rates, and no signal of
-- who is likely to respond.

CREATE TYPE "OutreachResponse" AS ENUM ('INTERESTED', 'NOT_NOW', 'NOT_INTERESTED');

-- Opens are recorded in Coral only. Email opens would need a tracking pixel.
-- No new index: the existing (candidate_id, created_at) one already serves a
-- candidate's own list of approaches.
ALTER TABLE "outreach_messages"
    ADD COLUMN "opened_at"       TIMESTAMP(3),
    ADD COLUMN "responded_at"    TIMESTAMP(3),
    ADD COLUMN "response"        "OutreachResponse",
    ADD COLUMN "response_note"   TEXT,
    ADD COLUMN "conversation_id" TEXT;
