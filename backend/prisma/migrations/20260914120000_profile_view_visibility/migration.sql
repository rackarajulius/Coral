-- Who a viewer appears as, to the person whose profile they opened.
--
-- 'named' | 'company' | 'private'. NULL on users means "the role default":
-- employers are attributed to their company, everyone else stays private.
ALTER TABLE "users" ADD COLUMN "profile_view_visibility" TEXT;

-- The choice as it was at the moment of the view. Snapshotting keeps a later
-- settings change from retroactively revealing past browsing, or from
-- un-telling a candidate something they were already shown.
-- Existing rows predate the setting, so they take the most private value.
ALTER TABLE "profile_impressions"
    ADD COLUMN "viewer_visibility" TEXT NOT NULL DEFAULT 'private';
