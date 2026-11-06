/**
 * Fill in where existing providers are based (place_country_code,
 * place_region, place_city) from the city and country they wrote. Profiles
 * saved since the provider_places migration already have it; saving a
 * profile also mends it, so this is for rows nobody has saved since.
 *
 *   npx ts-node scripts/backfill-provider-places.ts          # what it would do
 *   npx ts-node scripts/backfill-provider-places.ts --apply  # do it
 *
 * Safe to run again: it only touches rows whose place is not yet read.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CitiesService } from '../src/locations/cities.service';
import { readProviderPlace } from '../src/freelancers/provider-place';

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  const cities = new CitiesService();
  const profiles = await prisma.freelancerProfile.findMany({
    where: { placeCountryCode: null, OR: [{ city: { not: null } }, { country: { not: null } }] },
    select: { id: true, city: true, country: true },
  });
  console.log(`${profiles.length} provider profile(s) without a place${apply ? '' : ' (dry run; pass --apply to write)'}`);

  let unread = 0;
  for (const profile of profiles) {
    const place = readProviderPlace(cities, profile.city, profile.country);
    if (!place.placeCountryCode) unread++;
    console.log(`${profile.id}: ${JSON.stringify([profile.city, profile.country])} → ${[place.placeCity, place.placeRegion, place.placeCountryCode].filter(Boolean).join(', ') || '(not a known place)'}`);
    if (apply && place.placeCountryCode) {
      // Guarded by the same condition, so a save in between is not overwritten.
      await prisma.freelancerProfile.updateMany({ where: { id: profile.id, placeCountryCode: null }, data: place });
    }
  }
  if (unread) console.log(`${unread} couldn't be read; they match no location search until their owner edits the location.`);
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error('Backfill failed', error);
  await prisma.$disconnect();
  process.exit(1);
});
