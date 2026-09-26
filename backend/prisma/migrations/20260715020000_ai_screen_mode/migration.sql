-- Async video answers: text vs video screening mode.
ALTER TABLE "ai_screens" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'text';
