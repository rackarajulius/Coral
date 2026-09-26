import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { COMMUNITY_BUCKET, StorageService } from '../storage/storage.service';
import { User } from '../common/types/user.types';

/** How long an unattached upload is given before it is treated as abandoned. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Roughly a minute of 720p H.264. Longer than that nobody watches anyway. */
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/**
 * Accepted image formats, keyed by the bytes a file actually starts with.
 *
 * The declared MIME type is whatever the client typed. Since these land in a
 * public bucket and are served from our own domain, what matters is what the
 * file *is* — a script named `photo.png` served as an image is still hosted by
 * us and still linkable.
 */
type Kind = 'image' | 'video';

const SIGNATURES: Array<{
  mime: string;
  ext: string;
  kind: Kind;
  matches: (b: Buffer) => boolean;
}> = [
  {
    mime: 'image/png',
    ext: 'png',
    kind: 'image',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    kind: 'image',
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    kind: 'image',
    matches: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    kind: 'image',
    matches: (b) => b.length > 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')),
  },
  {
    /**
     * ISO base media: a length-prefixed 'ftyp' box at offset 4, whose brand
     * says what flavour it is. QuickTime files share this container, so the
     * brand is checked rather than the box alone — see `isQuickTime`.
     */
    mime: 'video/mp4',
    ext: 'mp4',
    kind: 'video',
    matches: (b) =>
      b.length > 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      !QUICKTIME_BRANDS.includes(b.subarray(8, 12).toString('ascii')),
  },
  {
    /** Matroska/WebM start with the EBML magic. */
    mime: 'video/webm',
    ext: 'webm',
    kind: 'video',
    matches: (b) =>
      b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
];

/** Brands that mark an ftyp file as QuickTime rather than MP4. */
const QUICKTIME_BRANDS = ['qt  ', 'moov', 'wide'];

/**
 * Images on community posts.
 *
 * Two rules make this safe enough to be public. Files are identified by their
 * own bytes rather than by what the uploader claimed, and posts may only
 * reference files in this bucket — so a post cannot embed a remote image that
 * reports every reader's address to someone else, or that changes after a
 * moderator has looked at it.
 */
@Injectable()
export class CommunityMediaService {
  private readonly logger = new Logger(CommunityMediaService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async upload(
    user: User,
    file: Express.Multer.File,
  ): Promise<{ url: string; path: string; kind: Kind }> {
    if (!file?.buffer?.length) throw new BadRequestException('No file received.');

    const signature = SIGNATURES.find((s) => s.matches(file.buffer));
    if (!signature) {
      /**
       * QuickTime gets its own message.
       *
       * It is the single most common thing someone will try to post — it is
       * what an iPhone records — and "unsupported file" would leave them
       * retrying the same export. Naming the fix is the difference between a
       * dead end and one extra step.
       */
      if (this.looksLikeQuickTime(file.buffer)) {
        throw new BadRequestException(
          'That looks like a QuickTime video from an iPhone, which many browsers cannot play. Export or convert it to MP4 and try again.',
        );
      }
      throw new BadRequestException(
        'Images must be PNG, JPEG, WebP or GIF, and videos must be MP4 or WebM.',
      );
    }

    const limit = signature.kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      throw new BadRequestException(
        signature.kind === 'video'
          ? 'Videos must be 30MB or smaller — about a minute.'
          : 'Images must be 5MB or smaller.',
      );
    }

    // Path carries the uploader, so a person's uploads are findable without a
    // second table, and a random name so one upload cannot overwrite another.
    const path = `posts/${user.id}/${randomUUID()}.${signature.ext}`;
    const url = await this.storage.uploadPublicFile(
      path,
      file.buffer,
      // The verified type, never the declared one.
      signature.mime,
      COMMUNITY_BUCKET,
    );
    return { url, path, kind: signature.kind };
  }

  /**
   * An ISO-container file whose brand marks it as QuickTime.
   *
   * Only used to explain a refusal — nothing is accepted on this basis.
   */
  private looksLikeQuickTime(b: Buffer): boolean {
    return (
      b.length > 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      QUICKTIME_BRANDS.includes(b.subarray(8, 12).toString('ascii'))
    );
  }

  /**
   * Whether a URL is one of ours.
   *
   * Post creation runs every media URL through this. Without it the field
   * accepts any address on the internet, which is a tracking pixel and a
   * bait-and-switch waiting to happen.
   */
  isOwnMedia(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.pathname.includes(`/${COMMUNITY_BUCKET}/`);
    } catch {
      return false;
    }
  }

  assertOwnMedia(urls: string[]): void {
    const foreign = urls.filter((u) => !this.isOwnMedia(u));
    if (foreign.length > 0) {
      throw new BadRequestException(
        'Images must be uploaded here rather than linked from another site.',
      );
    }
  }

  /**
   * Destroys the files behind a removed post.
   *
   * The post row is kept so the decision stays reviewable, but the image is
   * not: with an abusive picture, continued hosting *is* the harm, and a
   * public URL survives the post disappearing from every feed. What happened
   * is preserved in the moderation record; the bytes are not.
   */
  async deleteForUrls(urls: string[]): Promise<void> {
    for (const url of urls) {
      const path = this.pathFromUrl(url);
      if (!path) continue;
      try {
        await this.storage.deletePublicFile(path, COMMUNITY_BUCKET);
      } catch (err) {
        this.logger.warn(`Could not delete community media: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Deletes uploads that were never attached to a post.
   *
   * Upload and post creation are separate calls, so anyone who picks an image
   * and then abandons the draft leaves a file behind. Nothing references it and
   * nothing ever will, but it is a public URL that exists — so it is removed
   * rather than left addressable indefinitely.
   *
   * The grace period matters: a file uploaded seconds ago belongs to a post
   * still being written, and deleting it would break the compose someone is in
   * the middle of.
   */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'community-media-orphans' })
  async sweepOrphans(): Promise<void> {
    try {
      const cutoff = Date.now() - ORPHAN_GRACE_MS;

      // Uploads are laid out as posts/{userId}/{uuid}.{ext}, so the first
      // level is one folder per uploader.
      const folders = await this.storage.listFiles('posts', COMMUNITY_BUCKET);
      let removed = 0;

      for (const folder of folders) {
        // Folder entries come back without an id.
        if (folder.id) continue;

        const files = await this.storage.listFiles(`posts/${folder.name}`, COMMUNITY_BUCKET);
        const candidates = files.filter(
          (f) => f.id && f.createdAt && new Date(f.createdAt).getTime() < cutoff,
        );
        if (candidates.length === 0) continue;

        const paths = candidates.map((f) => `posts/${folder.name}/${f.name}`);

        /**
         * Scoped by author, because the folder name *is* the uploader's id.
         *
         * Matching on the stored array directly does not work: mediaUrls holds
         * absolute URLs while these are storage paths, so an exact-match query
         * finds nothing and the sweep would then treat every file as an orphan.
         */
        const referenced = await this.prisma.post.findMany({
          where: { authorId: folder.name },
          select: { mediaUrls: true },
        });
        const inUse = new Set(referenced.flatMap((p) => p.mediaUrls));

        for (const path of paths) {
          // Stored URLs are absolute, so a path is in use when some stored URL
          // ends with it.
          const used = [...inUse].some((url) => url.endsWith(path));
          if (used) continue;
          await this.storage.deletePublicFile(path, COMMUNITY_BUCKET);
          removed += 1;
        }
      }

      if (removed > 0) this.logger.log(`Removed ${removed} orphaned community upload(s).`);
    } catch (err) {
      this.logger.error(`Community media sweep failed: ${(err as Error).message}`);
    }
  }

  private pathFromUrl(url: string): string | null {
    try {
      const marker = `/${COMMUNITY_BUCKET}/`;
      const idx = new URL(url).pathname.indexOf(marker);
      return idx === -1 ? null : new URL(url).pathname.slice(idx + marker.length);
    } catch {
      return null;
    }
  }
}
