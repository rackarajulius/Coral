/**
 * Shrink pictures already in storage to the size they are shown at, in place.
 *
 * Uploads are resized in the browser since 2026-11-06 (src/lib/imageResize.ts
 * on the web). Everything stored before that is the original: phone photos of
 * 1–5 MB in the feed, and logos of up to 2.4 MB shown 36 pixels wide on every
 * post a company makes.
 *
 *   npx ts-node scripts/shrink-stored-images.ts                                 # report only
 *   npx ts-node scripts/shrink-stored-images.ts --apply --backup-dir <folder>   # do it
 *
 * Each file keeps its address and its format (a PNG stays a PNG), so no row
 * changes and nothing links to a file that is gone. It is only rewritten when
 * that makes it smaller, or when it carries camera metadata, which on a phone
 * photo usually includes where it was taken. GIFs and animated pictures are
 * left alone. --backup-dir keeps every original first; --apply refuses to run
 * without it. Safe to run again: a file already done is skipped.
 *
 * Needs sharp, which the app itself doesn't (it would ship the wrong binary
 * to Lambda): install it outside the project and point NODE_PATH at it, or
 * `npm i --no-save sharp@0.35.5` for one run.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ConfigService } from '@nestjs/config';
import { COMMUNITY_BUCKET, COMPANY_BUCKET, PROFILE_BUCKET, StorageService } from '../src/storage/storage.service';

// Untyped on purpose: sharp's types aren't installed with the app either.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const sharp: any = (() => {
  try {
    return require('sharp');
  } catch {
    console.error('sharp is not installed. Run `npm i --no-save sharp@0.35.5` first, or set NODE_PATH to a folder that has it.');
    process.exit(1);
  }
})();

/** Where pictures live, and how big each kind needs to be on its longest side. */
const TARGETS = [
  { bucket: COMMUNITY_BUCKET, prefix: 'posts', nested: true, maxEdge: 1600, label: 'post pictures' },
  { bucket: COMPANY_BUCKET, prefix: 'logos', maxEdge: 400, label: 'company logos', small: true },
  { bucket: COMPANY_BUCKET, prefix: 'banners', maxEdge: 2000, label: 'company banners' },
  { bucket: COMPANY_BUCKET, prefix: 'media', maxEdge: 1600, label: 'company gallery' },
  { bucket: PROFILE_BUCKET, prefix: 'avatars', maxEdge: 400, label: 'profile photos', small: true },
  { bucket: PROFILE_BUCKET, prefix: 'banners', maxEdge: 2000, label: 'profile banners' },
  { bucket: PROFILE_BUCKET, prefix: 'portfolio', maxEdge: 1600, label: 'portfolio pictures' },
] as const;

const PICTURE = /\.(png|jpe?g|webp)$/i;
/** Below this, a picture of the right size is left as it is. */
const SMALL_ENOUGH_BYTES = 300 * 1024;

const apply = process.argv.includes('--apply');
const backupAt = process.argv.indexOf('--backup-dir');
const backupDir = backupAt > 0 ? process.argv[backupAt + 1] : undefined;

async function filesUnder(storage: StorageService, bucket: string, prefix: string, nested: boolean): Promise<string[]> {
  const entries = await storage.listFiles(prefix, bucket);
  const files = entries.filter((e) => e.id).map((e) => `${prefix}/${e.name}`);
  if (!nested) return files;
  // posts/{uploader}/{file}: one folder per person.
  for (const folder of entries.filter((e) => !e.id)) {
    files.push(...(await storage.listFiles(`${prefix}/${folder.name}`, bucket)).filter((e) => e.id).map((e) => `${prefix}/${folder.name}/${e.name}`));
  }
  return files;
}

async function shrink(input: Buffer, maxEdge: number, small: boolean) {
  const meta = await sharp(input).metadata();
  const format = meta.format;
  if (!format || !['jpeg', 'png', 'webp'].includes(format) || (meta.pages ?? 1) > 1) return { skip: 'not a still PNG, JPEG or WebP' };
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const hasMetadata = !!meta.exif;
  if (longest <= maxEdge && !hasMetadata && input.length <= SMALL_ENOUGH_BYTES) return { skip: 'already fine' };

  // Turned upright by its own orientation note, then resized; sharp writes
  // no metadata unless asked, so the location goes with the rest.
  let pipeline = sharp(input).rotate().resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  pipeline = format === 'jpeg'
    ? pipeline.jpeg({ quality: 82, mozjpeg: true })
    : format === 'png'
      // A palette suits logos and profile photos at this size; larger PNGs
      // (screenshots, diagrams) keep every colour.
      ? pipeline.png({ compressionLevel: 9, palette: small })
      : pipeline.webp({ quality: 82 });
  const output = await pipeline.toBuffer();
  if (output.length >= input.length && !hasMetadata) return { skip: 'would not get smaller' };
  return { output, contentType: `image/${format}`, from: `${meta.width}x${meta.height}`, hasMetadata };
}

async function run() {
  if (apply && !backupDir) {
    console.error('--apply needs --backup-dir <folder>, so every original is kept.');
    process.exit(1);
  }
  const storage = new StorageService(new ConfigService({
    supabase: { url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY },
  }));
  await storage.onModuleInit();

  let totalBefore = 0;
  let totalAfter = 0;
  let located = 0;
  for (const target of TARGETS) {
    const files = (await filesUnder(storage, target.bucket, target.prefix, 'nested' in target && target.nested)).filter((f) => PICTURE.test(f));
    let before = 0;
    let after = 0;
    let changed = 0;
    for (const path of files) {
      const input = await storage.downloadFile(path, target.bucket);
      if (!input) continue;
      const result = await shrink(input, target.maxEdge, 'small' in target && target.small).catch((err: Error) => ({ skip: `unreadable (${err.message})` }));
      if ('skip' in result) continue;
      changed += 1;
      before += input.length;
      after += result.output.length;
      if (result.hasMetadata) located += 1;
      console.log(`  ${target.bucket}/${path}: ${result.from}, ${kb(input.length)} → ${kb(result.output.length)}${result.hasMetadata ? ' (camera metadata removed)' : ''}`);
      if (!apply) continue;
      const backup = join(backupDir!, target.bucket, path);
      mkdirSync(dirname(backup), { recursive: true });
      writeFileSync(backup, input);
      await storage.uploadPublicFile(path, result.output, result.contentType, target.bucket);
    }
    totalBefore += before;
    totalAfter += after;
    console.log(`${target.label}: ${files.length} picture(s), ${changed} to shrink, ${kb(before)} → ${kb(after)}`);
  }
  console.log(`\nIn all: ${kb(totalBefore)} → ${kb(totalAfter)}; ${located} carried camera metadata.${apply ? ` Originals kept in ${backupDir}.` : ' Dry run: pass --apply --backup-dir <folder> to write.'}`);
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
