/**
 * Move company logos and banners saved inline (`data:` URIs in
 * employer_profiles) into company storage, where uploads have gone since,
 * and keep the address instead.
 *
 * Inline images can't be sent with posts: a logo would ride along in every
 * post of a feed, and a banner is often over a megabyte on every company page
 * view. Posts show a logo only once it has an address.
 *
 *   npx ts-node scripts/move-inline-company-images.ts           # what it would do
 *   npx ts-node scripts/move-inline-company-images.ts --apply   # do it
 *   ... --apply --backup-dir <folder>                          # keep the originals too
 *
 * The stored file is the same bytes, so nothing changes on screen. Each row
 * is updated only if it still holds the image read, so a logo replaced in
 * between is left alone. Safe to run again.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { StorageService } from '../src/storage/storage.service';

/** What the company bucket accepts, and the extension each is saved with. */
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const FIELDS = [
  { field: 'companyLogo', folder: 'logos' },
  { field: 'companyBanner', folder: 'banners' },
] as const;

const apply = process.argv.includes('--apply');
const backupAt = process.argv.indexOf('--backup-dir');
const backupDir = backupAt > 0 ? process.argv[backupAt + 1] : undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  const storage = new StorageService(new ConfigService({
    supabase: { url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY },
  }));
  if (apply) await storage.onModuleInit();

  const profiles = await prisma.employerProfile.findMany({
    where: { OR: [{ companyLogo: { startsWith: 'data:' } }, { companyBanner: { startsWith: 'data:' } }] },
    select: { id: true, companyLogo: true, companyBanner: true },
  });
  console.log(`${profiles.length} company page(s) with inline images${apply ? '' : ' (dry run; pass --apply to move them)'}`);

  for (const profile of profiles) {
    for (const { field, folder } of FIELDS) {
      const inline = profile[field];
      if (!inline?.startsWith('data:')) continue;
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(inline);
      const ext = match && TYPES[match[1]];
      if (!match || !ext) {
        console.log(`  ${profile.id} ${field}: skipped, not a PNG, JPEG or WebP image (${inline.slice(5, 30)}…)`);
        continue;
      }
      const bytes = Buffer.from(match[2], 'base64');
      console.log(`  ${profile.id} ${field}: ${match[1]}, ${Math.round(bytes.length / 1024)} KB`);
      if (!apply) continue;

      if (backupDir) {
        mkdirSync(backupDir, { recursive: true });
        writeFileSync(join(backupDir, `${profile.id}-${field}.txt`), inline);
      }
      const url = await storage.uploadPublicFile(`${folder}/${profile.id}-inline-${Date.now()}.${ext}`, bytes, match[1]);
      // Only if it is still the image read: a new upload in between wins.
      const { count } = await prisma.employerProfile.updateMany({ where: { id: profile.id, [field]: inline }, data: { [field]: url } });
      console.log(count ? `    moved → ${url}` : '    changed meanwhile; left alone (the stored copy is unused)');
    }
  }
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error('Moving inline images failed', error);
  await prisma.$disconnect();
  process.exit(1);
});
