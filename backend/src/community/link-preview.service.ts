import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { COMMUNITY_BUCKET, StorageService } from '../storage/storage.service';

/** A slow page must not hold up someone's post. */
const FETCH_TIMEOUT_MS = 4000;
/** Enough for any <head>. Stops a download disguised as a web page. */
const MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** Our own copy, never the origin's URL. Null when there was none. */
  imageUrl: string | null;
}

/**
 * Turns the first link in a post into a card.
 *
 * The dangerous part of this feature is that it makes our server fetch a URL a
 * stranger chose. Left unguarded that reaches anything the server can reach —
 * cloud metadata endpoints, databases on the private network, admin panels
 * bound to localhost. Every check below exists for that, not for tidiness.
 */
@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(private readonly storage: StorageService) {}

  /** The first http(s) link in some text, or null. */
  firstUrl(text: string): string | null {
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    if (!match) return null;
    // Trailing punctuation is almost always the sentence, not the address.
    return match[0].replace(/[.,;:!?)\]]+$/, '');
  }

  /**
   * Best-effort. Returns null rather than throwing, because a link that will
   * not unfurl is a normal thing and must never stop a post being published.
   */
  async build(rawUrl: string, uploaderId: string): Promise<LinkPreview | null> {
    try {
      const url = await this.safeUrl(rawUrl);
      if (!url) return null;

      const html = await this.fetchHtml(url);
      if (!html) return null;

      const meta = this.parseMeta(html);
      const imageUrl = meta.image
        ? await this.copyImage(this.absolutise(meta.image, url), uploaderId)
        : null;

      // A card with no title is a grey box with a URL in it, which the link
      // itself already is.
      if (!meta.title && !meta.description) return null;

      return {
        url: url.toString(),
        title: meta.title,
        description: meta.description,
        siteName: meta.siteName ?? url.hostname.replace(/^www\./, ''),
        imageUrl,
      };
    } catch (err) {
      this.logger.warn(`Link preview failed: ${(err as Error).message}`);
      return null;
    }
  }

  /* --------------------------------- safety --------------------------------- */

  /**
   * Rejects anything that is not a public web address.
   *
   * The DNS lookup is the point: a hostname under someone else's control can
   * resolve to 127.0.0.1 or 169.254.169.254, so checking the string is not
   * enough — the address it actually resolves to has to be checked too.
   */
  private async safeUrl(raw: string): Promise<URL | null> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const host = url.hostname;
    if (this.isPrivateHost(host)) return null;

    try {
      const resolved = await lookup(host, { all: true });
      if (resolved.length === 0) return null;
      if (resolved.some((r) => this.isPrivateAddress(r.address))) return null;
    } catch {
      return null;
    }
    return url;
  }

  private isPrivateHost(host: string): boolean {
    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.internal')) {
      return true;
    }
    return isIP(lower) !== 0 && this.isPrivateAddress(lower);
  }

  /** Loopback, link-local, and every RFC 1918 range, v4 and v6. */
  private isPrivateAddress(address: string): boolean {
    if (address.includes(':')) {
      const v6 = address.toLowerCase();
      return (
        v6 === '::1' ||
        v6.startsWith('fc') || v6.startsWith('fd') || // unique local
        v6.startsWith('fe80') ||                       // link-local
        v6.startsWith('::ffff:127.') || v6 === '::'
      );
    }
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||           // link-local, includes cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                              // multicast and reserved
    );
  }

  /* -------------------------------- fetching -------------------------------- */

  private async fetchHtml(url: URL): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        // Manual, so a redirect cannot land somewhere the checks above already
        // rejected. One hop is not worth re-validating; we simply stop.
        redirect: 'manual',
        headers: { 'User-Agent': 'CoralBot/1.0 (+link preview)', Accept: 'text/html' },
      });
      if (!res.ok) return null;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return null;

      const body = await res.text();
      return body.slice(0, MAX_HTML_BYTES);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The preview image, copied into our bucket.
   *
   * Hotlinking would tell the origin the address of everyone who scrolls past
   * the post, and would let the picture be swapped after a moderator cleared
   * it — the same two reasons GIFs are copied rather than embedded.
   */
  private async copyImage(imageUrl: string | null, uploaderId: string): Promise<string | null> {
    if (!imageUrl) return null;
    try {
      const url = await this.safeUrl(imageUrl);
      if (!url) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url.toString(), { signal: controller.signal, redirect: 'manual' });
        if (!res.ok) return null;

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_IMAGE_BYTES) return null;

        // Same byte check as every other upload — a content-type header is the
        // origin's opinion.
        const kind = this.imageKind(buffer);
        if (!kind) return null;

        const path = `link-previews/${uploaderId}/${randomUUID()}.${kind.ext}`;
        return await this.storage.uploadPublicFile(path, buffer, kind.mime, COMMUNITY_BUCKET);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  }

  private imageKind(b: Buffer): { mime: string; ext: string } | null {
    if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { mime: 'image/png', ext: 'png' };
    }
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }
    if (
      b.length > 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { mime: 'image/webp', ext: 'webp' };
    }
    return null;
  }

  /* --------------------------------- parsing -------------------------------- */

  private parseMeta(html: string) {
    const head = html.slice(0, MAX_HTML_BYTES);
    return {
      title:
        this.metaContent(head, 'og:title') ??
        this.tagText(head, 'title') ??
        null,
      description:
        this.metaContent(head, 'og:description') ??
        this.metaContent(head, 'description') ??
        null,
      siteName: this.metaContent(head, 'og:site_name'),
      image: this.metaContent(head, 'og:image'),
    };
  }

  /** Matches property= and name=, in either attribute order. */
  private metaContent(html: string, key: string): string | null {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return this.decode(match[1]).slice(0, 300);
    }
    return null;
  }

  private tagText(html: string, tag: string): string | null {
    const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
    return match?.[1] ? this.decode(match[1]).slice(0, 300) : null;
  }

  /** Only the entities that actually turn up in titles. */
  private decode(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private absolutise(value: string | null, base: URL): string | null {
    if (!value) return null;
    try {
      return new URL(value, base).toString();
    } catch {
      return null;
    }
  }
}
