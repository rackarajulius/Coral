import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { COMMUNITY_BUCKET, StorageService } from '../storage/storage.service';

/** What a YouTube or Vimeo work sample shows instead of a bare link. */
export interface VideoPreview {
  title: string | null;
  siteName: string;
  /** Our own copy of the thumbnail, never the video site's address. */
  imageUrl: string | null;
}

const TIMEOUT_MS = 5000;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
/** Where the two sites serve thumbnails from; nothing else is fetched. */
const THUMBNAIL_HOSTS = ['i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com'];

/**
 * A preview card for a video on YouTube or Vimeo: its title, the site, and
 * a thumbnail.
 *
 * Read from each site's public oEmbed address — fixed, so a work sample can't
 * make the server fetch anything else — once, when the listing is saved. The
 * thumbnail is copied into our own storage rather than loaded from the site,
 * and the video is never embedded: a player on the listing page would let the
 * video site follow everyone who opens it. Clicking the card goes to the
 * video. Anything that fails leaves the sample as a plain link.
 */
@Injectable()
export class VideoPreviewService {
  private readonly logger = new Logger(VideoPreviewService.name);

  constructor(private readonly storage: StorageService) {}

  /** The oEmbed address for a supported video page, or null for anything else. */
  oembedFor(rawUrl: string): { endpoint: string; siteName: string } | null {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
      return { endpoint: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`, siteName: 'YouTube' };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      return { endpoint: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url.href)}`, siteName: 'Vimeo' };
    }
    return null;
  }

  async preview(url: string, ownerId: string): Promise<VideoPreview | null> {
    const source = this.oembedFor(url);
    if (!source) return null;
    try {
      const res = await fetch(source.endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
      if (!res.ok) return null;
      const body = (await res.json()) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) || null : null;
      const thumbnail = typeof body.thumbnail_url === 'string' ? await this.copyThumbnail(body.thumbnail_url, ownerId) : null;
      return { title, siteName: source.siteName, imageUrl: thumbnail };
    } catch (error) {
      this.logger.warn(`No preview for a ${source.siteName} work sample: ${(error as Error).message}`);
      return null;
    }
  }

  private async copyThumbnail(rawUrl: string, ownerId: string): Promise<string | null> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || !THUMBNAIL_HOSTS.includes(url.hostname.toLowerCase())) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    if (!res.ok) return null;
    if (Number(res.headers.get('content-length') ?? 0) > MAX_THUMBNAIL_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_THUMBNAIL_BYTES) return null;
    // By the bytes, as every upload is: only a real picture is stored.
    const kind =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff ? { ext: 'jpg', mime: 'image/jpeg' }
        : buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? { ext: 'png', mime: 'image/png' }
          : buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' ? { ext: 'webp', mime: 'image/webp' }
            : null;
    if (!kind) return null;
    // Beside the community's link-preview images, which the media clean-up leaves alone.
    return this.storage.uploadPublicFile(`link-previews/${ownerId}/${randomUUID()}.${kind.ext}`, buffer, kind.mime, COMMUNITY_BUCKET);
  }
}
