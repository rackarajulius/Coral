-- Pictures (up to 8) and one short video of the work, on a service listing.
ALTER TABLE "service_listings" ADD COLUMN "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
