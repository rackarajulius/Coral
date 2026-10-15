import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PROFILE_BUCKET, StorageService } from '../storage/storage.service';

/** A slow photo host must not hold a request open. */
const FETCH_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Big enough for the largest place a face is shown (the profile header). */
const MIRROR_SIZE = 400;

/**
 * Copies a sign-in provider's profile photo into our own storage.
 *
 * Google photos (lh3.googleusercontent.com) were linked to directly. Google
 * answers 429 to every request after the first once a Referer is sent, so
 * faces turned into initials, and the address can change or expire whenever
 * Google likes. Our copy has neither problem.
 *
 * Only Google's photo host is fetched. The URL comes from Supabase user
 * metadata, which the account holder can write to, so fetching any address
 * found there would let anyone make this server request whatever they chose.
 */
@Injectable()
export class ProviderAvatarService {
  private readonly logger = new Logger(ProviderAvatarService.name);
  /** Sign-in fires several requests at once; one copy per account is enough. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** True for a photo still hosted by the provider rather than by us. */
  isProviderHosted(url: string | null | undefined): url is string {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname.endsWith('.googleusercontent.com');
    } catch {
      return false;
    }
  }

  /**
   * Starts copying the account's provider photo, if it still has one.
   *
   * Never awaited by sign-in and never throws: a photo that could not be
   * copied this time is still the provider's, and the next sign-in tries
   * again.
   */
  mirrorInBackground(userId: string, avatarUrl: string | null | undefined): void {
    if (!this.isProviderHosted(avatarUrl) || this.inFlight.has(userId)) return;
    this.inFlight.add(userId);
    void this.mirror(userId, avatarUrl)
      .catch((err) => this.logger.warn(`Could not copy profile photo for ${userId}: ${(err as Error).message}`))
      .finally(() => this.inFlight.delete(userId));
  }

  private async mirror(userId: string, providerUrl: string): Promise<void> {
    const image = await this.download(this.sized(providerUrl));
    if (!image) return;

    const path = `avatars/${userId}-provider-${Date.now()}.${image.ext}`;
    const ownUrl = await this.storage.uploadPublicFile(path, image.buffer, image.mime, PROFILE_BUCKET);

    // Only if the photo is still the one we copied. The person may have
    // uploaded or removed a photo meanwhile, or another server got here first.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, avatarUrl: providerUrl },
      data: { avatarUrl: ownUrl },
    });
    if (count === 0) await this.storage.deletePublicFile(path, PROFILE_BUCKET);
  }

  /** Google's URLs carry the size; the default 96px blurs on the profile page. */
  private sized(url: string): string {
    return url.replace(/=s\d+(-c)?$/, `=s${MIRROR_SIZE}-c`);
  }

  private async download(url: string): Promise<{ buffer: Buffer; mime: string; ext: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      // No Referer is sent from here, which is what keeps Google from
      // throttling. Redirects are refused so the host check above holds.
      const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
      if (!res.ok) throw new Error(`photo host answered ${res.status}`);

      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_IMAGE_BYTES) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_IMAGE_BYTES) return null;

      // The bytes decide, not the content-type header.
      const kind = this.imageKind(buffer);
      return kind ? { buffer, ...kind } : null;
    } finally {
      clearTimeout(timer);
    }
  }

  private imageKind(b: Buffer): { mime: string; ext: string } | null {
    if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { mime: 'image/png', ext: 'png' };
    }
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }
    if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') {
      return { mime: 'image/webp', ext: 'webp' };
    }
    return null;
  }
}
