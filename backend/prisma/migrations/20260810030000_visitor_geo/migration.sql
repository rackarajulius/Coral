-- Coarse visitor location.
--
-- Two columns because there are two sources of very different accuracy, and
-- merging them into one field would hide which you're looking at:
--
--   country  - ISO-2 from the CDN/proxy (Cloudflare, Vercel, CloudFront...).
--              Accurate, but only present when deployed behind one.
--   timezone - IANA zone reported by the browser. Always available, but only
--              good enough for a continent-level region.
--
-- Neither is derived from a stored IP: the address is read from the request
-- header, used, and discarded — same rule as the session hash.
ALTER TABLE "analytics_events" ADD COLUMN "country"  TEXT;
ALTER TABLE "analytics_events" ADD COLUMN "timezone" TEXT;
