-- People the team saved or sourced and never wrote to.
--
-- A singleton task like the first three: it answers one question about the
-- whole company, so config_key stays empty.
ALTER TYPE "ScheduledTaskType" ADD VALUE IF NOT EXISTS 'SAVED_NOT_CONTACTED';
