import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { COMMUNITY_BUCKET, StorageService } from '../storage/storage.service';
import { User } from '../common/types/user.types';

/** Tenor caps at 50; more than a couple of rows is scrolling, not choosing. */
const RESULT_LIMIT = 24;

/** A GIF over this is a video someone forgot to encode. */
const MAX_GIF_BYTES = 8 * 1024 * 1024;

export interface GifResult {
  id: string;
  /** Small looping preview for the picker grid. */
  previewUrl: string;
  /** The full-size file, fetched server-side when one is chosen. */
  url: string;
  description: string;
  width: number;
  height: number;
}

/**
 * GIF search, and copying the chosen one into our own storage.
 *
 * The copy is the important part. Embedding Tenor's URL directly would mean
 * every reader's browser calls Tenor on every render — handing a third party
 * the address of everyone who reads the post — and it would mean the image can
 * change, or vanish, after a moderator has already looked at it.
 *
 * Fetching once and storing it keeps both properties this codebase already
 * relies on: posts only ever reference our own bucket, and a moderator's
 * removal actually removes something.
 */
@Injectable()
export class GifsService {
  private readonly logger = new Logger(GifsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('TENOR_API_KEY', '').trim());
  }

  /**
   * Searches Tenor.
   *
   * `contentfilter=high` is not optional here. This is a professional network,
   * the results are one tap from a post, and the default filter lets through
   * things nobody wants beside their name.
   */
  async search(query: string): Promise<GifResult[]> {
    const key = this.apiKey();
    const trimmed = query.trim();
    if (!trimmed) return [];

    const url = new URL('https://tenor.googleapis.com/v2/search');
    url.searchParams.set('key', key);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('limit', String(RESULT_LIMIT));
    url.searchParams.set('contentfilter', 'high');
    url.searchParams.set('media_filter', 'tinygif,gif');
    url.searchParams.set('client_key', 'coral');

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new BadGatewayException(`GIF search failed (${res.status}).`);
    }

    const body = (await res.json()) as {
      results?: Array<{
        id: string;
        content_description?: string;
        media_formats?: Record<string, { url: string; dims?: number[] }>;
      }>;
    };

    return (body.results ?? [])
      .map((r) => {
        const full = r.media_formats?.gif;
        const preview = r.media_formats?.tinygif ?? full;
        if (!full || !preview) return null;
        return {
          id: r.id,
          previewUrl: preview.url,
          url: full.url,
          description: r.content_description ?? 'GIF',
          width: full.dims?.[0] ?? 0,
          height: full.dims?.[1] ?? 0,
        };
      })
      .filter((r): r is GifResult => r !== null);
  }

  /**
   * Copies a chosen GIF into our bucket and returns our URL.
   *
   * The source must be a Tenor address. Without that check this becomes an
   * open proxy: anyone could ask the server to fetch an arbitrary URL and
   * republish it under our domain.
   */
  async adopt(user: User, sourceUrl: string): Promise<{ url: string; path: string }> {
    this.apiKey();

    if (!this.isTenorUrl(sourceUrl)) {
      throw new BadRequestException('That GIF did not come from the picker.');
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) {
      throw new BadGatewayException('Could not fetch that GIF.');
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_GIF_BYTES) {
      throw new BadRequestException('That GIF is too large.');
    }
    // Checked by bytes, like every other upload — a URL ending in .gif proves
    // nothing about what came back.
    const isGif = buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
    if (!isGif) {
      throw new BadRequestException('That file is not a GIF.');
    }

    const path = `posts/${user.id}/${randomUUID()}.gif`;
    const url = await this.storage.uploadPublicFile(path, buffer, 'image/gif', COMMUNITY_BUCKET);
    return { url, path };
  }

  /* --------------------------------- helpers -------------------------------- */

  private isTenorUrl(value: string): boolean {
    try {
      const host = new URL(value).hostname.toLowerCase();
      // Suffix-matched against a leading dot so `tenor.com.evil.net` and
      // `nottenor.com` both fail.
      return host === 'tenor.com' || host.endsWith('.tenor.com') || host.endsWith('.googleusercontent.com');
    } catch {
      return false;
    }
  }

  private apiKey(): string {
    const key = this.config.get<string>('TENOR_API_KEY', '').trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'GIF search is not configured. Set TENOR_API_KEY in backend/.env',
      );
    }
    return key;
  }
}
