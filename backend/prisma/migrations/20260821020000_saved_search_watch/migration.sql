-- Watching a saved search for new matches.
--
-- Unlike the three singleton tasks, a company can watch several searches at
-- once — config_key already carries the shortlist id, so the existing unique
-- index (company_id, type, config_key) permits one watcher per search and no
-- duplicates.
ALTER TYPE "ScheduledTaskType" ADD VALUE IF NOT EXISTS 'SAVED_SEARCH_MATCHES';
