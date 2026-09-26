-- Ad-hoc audio and video calls inside a conversation.
--
-- The media itself is peer-to-peer WebRTC signalled over the conversation's
-- existing Realtime channel, so none of it passes through this server. What the
-- server owns is the part a scheduled interview never needs: telling the other
-- person a call is happening *now*, letting them decline, and recording what
-- became of it.
--
-- Deliberately not a phone call: no number is exchanged in either direction,
-- which keeps this inside the same consent boundary as messaging.

CREATE TYPE "CallMode" AS ENUM ('AUDIO', 'VIDEO');

-- FAILED is distinct from MISSED on purpose. Missed means nobody picked up;
-- failed means both sides tried and the connection could not be established —
-- with STUN-only and no TURN relay, that is an expected outcome on strict
-- networks and must be reported as such rather than as a no-answer.
CREATE TYPE "CallState" AS ENUM ('RINGING', 'ACCEPTED', 'DECLINED', 'MISSED', 'ENDED', 'FAILED');

CREATE TABLE "calls" (
  "id"              TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "caller_id"       TEXT NOT NULL,
  "callee_id"       TEXT NOT NULL,
  "mode"            "CallMode" NOT NULL,
  "state"           "CallState" NOT NULL DEFAULT 'RINGING',
  "started_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answered_at"     TIMESTAMP(3),
  "ended_at"        TIMESTAMP(3),
  -- Null when never answered, so "no answer" stays distinguishable from a
  -- zero-second call.
  "duration_sec"    INTEGER,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calls_conversation_started_idx" ON "calls"("conversation_id", "started_at" DESC);
-- The sweeper's query: anything still ringing past its timeout.
CREATE INDEX "calls_state_started_idx" ON "calls"("state", "started_at");

ALTER TABLE "calls"
  ADD CONSTRAINT "calls_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
