-- Offer signals as they stood when the offer was sent, for the outcomes report.
ALTER TABLE "offers" ADD COLUMN "signals_at_send" JSONB;
