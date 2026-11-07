/**
 * Clear display names that are just the email's local part ("jsmith1987"
 * for jsmith1987@example.com). Sign-up used to fill an empty display name
 * that way; it no longer does, and the community, marketplace and provider
 * pages would otherwise show it to strangers as this person's name.
 *
 *   npx ts-node scripts/clear-email-display-names.ts          # how many, no changes
 *   npx ts-node scripts/clear-email-display-names.ts --apply  # clear them
 *
 * Nothing is lost: each cleared value is still the start of that account's
 * email. People with a first or last name are then called by it; anyone with
 * neither is "Member" until they add one. Prints account ids only, never
 * emails or names. Safe to run again.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  const rows = await prisma.$queryRaw<Array<{ id: string; has_name: boolean }>>`
    SELECT id, (coalesce(btrim(first_name), '') <> '' OR coalesce(btrim(last_name), '') <> '') AS has_name
    FROM users
    WHERE display_name IS NOT NULL
      AND lower(btrim(display_name)) = lower(split_part(email, '@', 1))`;
  const named = rows.filter((row) => row.has_name).length;
  console.log(`${rows.length} account(s) whose display name is their email's local part; ${named} have a first or last name to fall back on${apply ? '' : ' (dry run; pass --apply to clear)'}`);
  for (const row of rows) console.log(`  ${row.id}${row.has_name ? '' : ' (no name yet: shown as "Member")'}`);

  if (apply && rows.length) {
    // The same condition again, so a name set in between is not cleared.
    const cleared = await prisma.$executeRaw`
      UPDATE users SET display_name = NULL
      WHERE display_name IS NOT NULL
        AND lower(btrim(display_name)) = lower(split_part(email, '@', 1))`;
    console.log(`Cleared ${cleared}.`);
  }
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error('Clearing display names failed', error);
  await prisma.$disconnect();
  process.exit(1);
});
