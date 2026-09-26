-- Real traffic-source attribution.
--
-- `source` already held a referrer host, but it was read from the API request's
-- Referer header — which for a single-page app is the app's OWN url, not where
-- the visitor came from. The true referrer exists only in the browser, in
-- document.referrer on the initial navigation, so it has to be reported by the
-- client and stored explicitly.
--
-- UTM parameters are the other half: paid and campaign traffic is attributed by
-- tag, not by referrer, and a referrer alone cannot distinguish an organic
-- LinkedIn post from a paid LinkedIn ad.
ALTER TABLE "analytics_events" ADD COLUMN "utm_source"   TEXT;
ALTER TABLE "analytics_events" ADD COLUMN "utm_medium"   TEXT;
ALTER TABLE "analytics_events" ADD COLUMN "utm_campaign" TEXT;

-- Aggregating sessions by where they came from.
CREATE INDEX "analytics_events_employer_id_type_occurred_at_idx"
  ON "analytics_events"("employer_id", "type", "occurred_at");
