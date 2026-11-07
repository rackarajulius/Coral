import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COMPANY_BUCKET, StorageService } from '../storage/storage.service';
import { normalizeName, sameCompany } from './job-sources/types';

/** Stored size; the card tile is 48px, so this stays sharp on 2x screens. */
const LOGO_SIZE = 128;
/** Smaller than this blurs in the tile, and the letter reads better. */
const MIN_LOGO_PX = 32;
const MAX_LOGO_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5000;
/** Logo.dev may prepare a logo during the request, and asks for at least 15s. */
const LOGO_DEV_TIMEOUT_MS = 20000;
/** Logo.dev limits concurrent API requests; a search can ask about a dozen companies. */
const LOGO_DEV_CONCURRENCY = 4;
/** After Logo.dev reports its credits are used up, leave it alone this long. */
const CREDITS_OUT_PAUSE_MS = 6 * 3600_000;
const FOUND_TTL_MS = 7 * 24 * 3600_000;
const MISSING_TTL_MS = 24 * 3600_000;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Where JSearch's employer logos are hosted (Google image thumbnails). Nothing else is fetched. */
const LOGO_IMAGE_HOST = /(^|\.)gstatic\.com$/;

/** A company whose logo a match card wants. */
export interface LogoSubject {
  /** Its website, when known and trusted (configured boards, or one that spells the name). */
  domain?: string;
  company: string;
  /** An image of its logo published with the listing (JSearch), copied if used. */
  imageUrl?: string;
  /**
   * Whether its website may be looked up by name. Off for Coral's own
   * employers, who can upload a logo, and whose names are often small local
   * businesses that a name search would confuse with someone else.
   */
  byName: boolean;
}

/** Answers kept for a week when something was found, a day when not. */
class Remembered {
  constructor(readonly kind: string) {}

  private readonly entries = new Map<string, { value: string | null; at: number }>();

  /** The answer, null for "none", or undefined when unknown or stale. */
  get(key: string): string | null | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    const ttl = hit.value ? FOUND_TTL_MS : MISSING_TTL_MS;
    return Date.now() - hit.at < ttl ? hit.value : undefined;
  }

  set(key: string, value: string | null): void {
    this.entries.set(key, { value, at: Date.now() });
  }
}

/**
 * Logos for employers on match cards, kept in our own storage.
 *
 * Job boards carry no logos. The employers on Greenhouse, Lever and Ashby are
 * configured with their websites; JSearch gives a logo image and sometimes a
 * website; Adzuna gives only a company name, which Logo.dev's search turns
 * into a website when it is clearly the same company.
 *
 * A logo comes from Logo.dev when it is configured, otherwise (or when it has
 * none) from Google's site icons. Either way it is stored once and served from
 * our storage, so the people viewing matches contact neither — Google
 * throttled hotlinked profile photos into initials until those were copied
 * the same way. Logo.dev permits keeping copies of logos from its API (not its
 * image CDN), which is the route used here.
 *
 * No logo is better than a wrong one: a doubtful name match, an icon too small
 * to read, or Google's generic globe for unknown sites all leave the letter.
 */
@Injectable()
export class CompanyLogoService {
  private readonly logger = new Logger(CompanyLogoService.name);
  /** Website → stored logo address, or null when there is none. */
  private readonly logos = new Remembered('logo');
  /** Normalized company name → website, or null when no confident match. */
  private readonly websites = new Remembered('site');
  /** Listing logo image address → our stored copy, or null when unusable. */
  private readonly images = new Remembered('image');
  private readonly pending = new Map<string, Promise<void>>();
  private creditsOutUntil = 0;
  private logoDevActive = 0;
  private readonly logoDevQueue: Array<() => void> = [];

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Starts finding logos for these companies. Resolves when every lookup has
   * finished; never rejects. Logos still loading when a search is ready to
   * answer are left off that answer and cached for the next one.
   */
  prefetch(subjects: LogoSubject[]): Promise<void> {
    return Promise.all(subjects.map((s) => this.find(s))).then(() => undefined);
  }

  /** The stored logo for this company, if one has been found. */
  logoFor(subject: LogoSubject): string | undefined {
    const domain = valid(subject.domain);
    const byWebsite = domain && this.logos.get(domain);
    if (byWebsite) return byWebsite;

    const image = logoImage(subject.imageUrl);
    const copied = image && this.images.get(image);
    if (copied) return copied;

    if (domain || !subject.byName) return undefined;
    const found = this.websites.get(normalizeName(subject.company));
    return (found && this.logos.get(found)) || undefined;
  }

  /* ------------------------------- lookups ------------------------------- */

  /**
   * In order of trust: the company's own website; then a logo image published
   * with the listing; then, only with nothing else, its website found by name.
   */
  private async find(subject: LogoSubject): Promise<void> {
    const domain = valid(subject.domain);
    if (domain) {
      await this.once(this.logos, domain, () => this.findLogo(domain));
      if (this.logos.get(domain)) return;
    }

    const image = logoImage(subject.imageUrl);
    if (image) {
      await this.once(this.images, image, () => this.copyImage(image));
      if (this.images.get(image)) return;
    }

    if (domain || !subject.byName) return;
    const name = normalizeName(subject.company);
    if (!name) return;
    await this.once(this.websites, name, () => this.websiteFor(subject.company));
    const found = this.websites.get(name);
    if (found) await this.once(this.logos, found, () => this.findLogo(found));
  }

  /**
   * Runs a lookup unless its answer is already remembered, and at most once
   * at a time per key. A failed lookup is not remembered, so
   * the next search tries again.
   */
  private once(cache: Remembered, key: string, work: () => Promise<string | null>): Promise<void> {
    if (cache.get(key) !== undefined) return Promise.resolve();
    const pendingKey = `${cache.kind}:${key}`;
    const inFlight = this.pending.get(pendingKey);
    if (inFlight) return inFlight;

    const run = work()
      .then((answer) => cache.set(key, answer))
      .catch((err) => this.logger.warn(`Logo lookup for ${key} unavailable: ${err instanceof Error ? err.message : err}`))
      .finally(() => this.pending.delete(pendingKey));
    this.pending.set(pendingKey, run);
    return run;
  }

  /** Our stored copy if there is one, otherwise a fresh one, or null for none. */
  private async findLogo(domain: string): Promise<string | null> {
    // Without storage there is nowhere to keep a copy, and linking the source
    // directly is what this exists to avoid.
    const logoDevPath = `job-board-logos/logo-dev/${domain}.png`;
    const googlePath = `job-board-logos/${domain}.png`;
    const logoDevCopy = this.storage.publicUrlFor(logoDevPath, COMPANY_BUCKET);
    if (!logoDevCopy) return null;

    const googleCopy = this.storage.publicUrlFor(googlePath, COMPANY_BUCKET)!;

    if (this.logoDevReady()) {
      if (await this.isServed(logoDevCopy)) return logoDevCopy;
      // A site icon we already keep is shown while Logo.dev's logo is fetched,
      // rather than leaving the card a letter until it arrives.
      if (await this.isServed(googleCopy)) {
        this.upgradeInBackground(domain, logoDevPath);
        return googleCopy;
      }
      const png = await this.fromLogoDev(domain);
      if (png) return this.storage.uploadPublicFile(logoDevPath, png, 'image/png', COMPANY_BUCKET);
      // Logo.dev has none (or is out of credits): Google's icon may still do.
    }

    if (await this.isServed(googleCopy)) return googleCopy;
    const png = await this.fromGoogle(domain);
    return png ? this.storage.uploadPublicFile(googlePath, png, 'image/png', COMPANY_BUCKET) : null;
  }

  /** Replaces a site icon with Logo.dev's logo once it has been fetched. */
  private upgradeInBackground(domain: string, logoDevPath: string): void {
    const key = `upgrade:${domain}`;
    if (this.pending.has(key)) return;
    const run = this.fromLogoDev(domain)
      .then(async (png) => {
        if (!png) return;
        this.logos.set(domain, await this.storage.uploadPublicFile(logoDevPath, png, 'image/png', COMPANY_BUCKET));
      })
      .catch((err) => this.logger.warn(`Logo.dev logo for ${domain} unavailable: ${err instanceof Error ? err.message : err}`))
      .finally(() => this.pending.delete(key));
    this.pending.set(key, run);
  }

  /**
   * Our copy of a logo image published with a listing, or null when unusable.
   *
   * JSearch's employer logos are Google image thumbnails (48–128px). Linked
   * directly, Google would throttle them as it did profile photos; and only
   * Google's image host is fetched, never an address a listing could choose.
   */
  private async copyImage(url: string): Promise<string | null> {
    const path = `job-board-logos/images/${createHash('sha256').update(url).digest('hex').slice(0, 32)}`;
    const ours = this.storage.publicUrlFor(path, COMPANY_BUCKET);
    if (!ours) return null;
    if (await this.isServed(ours)) return ours;

    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 429 || res.status >= 500) throw new Error(`logo image answered ${res.status}`);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const image = usableImage(bytes);
    return image ? this.storage.uploadPublicFile(path, bytes, image.mime, COMPANY_BUCKET) : null;
  }

  private async isServed(url: string): Promise<boolean> {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok;
  }

  /* -------------------------------- Google ------------------------------- */

  /** The site's icon from Google, or null. Google answers 404 with a 16px globe for unknown sites. */
  private async fromGoogle(domain: string): Promise<Buffer | null> {
    const res = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${LOGO_SIZE}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    return usablePng(Buffer.from(await res.arrayBuffer()));
  }

  /* ------------------------------- Logo.dev ------------------------------ */

  private logoDevKey(): string | undefined {
    return this.config.get<string>('LOGO_DEV_SECRET_KEY')?.trim() || undefined;
  }

  private logoDevReady(): boolean {
    return !!this.logoDevKey() && Date.now() >= this.creditsOutUntil;
  }

  /**
   * The website of the company with this name, only when it is unambiguous.
   * Logo.dev's own guidance is that a name can match the wrong brand, and a
   * wrong logo on a job card misrepresents who is hiring, so anything
   * doubtful is null and the card keeps its letter.
   *
   * Same names are common: checked live, "Harvey", "Affirm", "Faire" and
   * "Venn" each returned two or three different companies, and the top
   * "Cerebras" was not Cerebras Systems. So a name is accepted only when one
   * candidate fits it, or every fitting candidate is the same brand under
   * another country's domain (OpenTable .com / .fr / .ie).
   */
  private async websiteFor(company: string): Promise<string | null> {
    if (!this.logoDevReady()) return null;
    const res = await this.logoDev(`/v2/search?q=${encodeURIComponent(company)}&limit=5`);
    if (!res.ok) throw new Error(`Logo.dev search answered ${res.status}`);
    const body = (await res.json()) as { data?: Array<{ name?: string; domain?: string }> };
    const fitting = (body.data ?? []).filter((c) => valid(c.domain) && sameCompany(company, c.name ?? '', c.domain!));
    if (fitting.length === 0) return null;

    const [best] = fitting;
    const label = (domain: string) => domain.toLowerCase().split('.')[0];
    const oneBrand = fitting.every((c) => c.name === best.name && label(c.domain!) === label(best.domain!));
    return oneBrand ? valid(best.domain)! : null;
  }

  /**
   * The company's logo from Logo.dev's API, as a PNG, or null when it has none.
   *
   * The API answers with a temporary download address; the file is what is
   * kept, as Logo.dev's self-hosting terms ask. Downloads from that address
   * are not billed; the logo request costs two credits, once per company.
   */
  private async fromLogoDev(domain: string): Promise<Buffer | null> {
    const res = await this.logoDev(`/v2/brands/logo?domain=${encodeURIComponent(domain)}`);
    if (res.status === 404) return null;
    if (res.status === 402) {
      this.creditsOutUntil = Date.now() + CREDITS_OUT_PAUSE_MS;
      this.logger.warn('Logo.dev credits are used up; using site icons until they renew');
      return null;
    }
    // 202 means Logo.dev is still preparing the brand; ask again later.
    if (!res.ok || res.status === 202) throw new Error(`Logo.dev answered ${res.status}`);

    const body = (await res.json()) as { url?: string; data?: { url?: string } };
    const temporary = body.data?.url ?? body.url;
    if (!temporary) return null;

    const download = new URL(temporary);
    download.searchParams.set('size', String(LOGO_SIZE));
    download.searchParams.set('format', 'png');
    const file = await fetch(download, { signal: AbortSignal.timeout(LOGO_DEV_TIMEOUT_MS) });
    if (!file.ok) throw new Error(`Logo.dev download answered ${file.status}`);
    return usablePng(Buffer.from(await file.arrayBuffer()));
  }

  /** A Logo.dev API request, at most LOGO_DEV_CONCURRENCY at a time. */
  private async logoDev(pathAndQuery: string): Promise<Response> {
    if (this.logoDevActive >= LOGO_DEV_CONCURRENCY) {
      await new Promise<void>((go) => this.logoDevQueue.push(go));
    }
    this.logoDevActive++;
    try {
      return await fetch(`https://api.logo.dev${pathAndQuery}`, {
        headers: { Authorization: `Bearer ${this.logoDevKey()}` },
        signal: AbortSignal.timeout(LOGO_DEV_TIMEOUT_MS),
      });
    } finally {
      this.logoDevActive--;
      this.logoDevQueue.shift()?.();
    }
  }
}

/* -------------------------------- helpers -------------------------------- */

function valid(domain: string | undefined): string | undefined {
  const d = domain?.trim().toLowerCase();
  return d && DOMAIN.test(d) ? d : undefined;
}

/** A listing's logo image address, only on Google's image host and over https. */
function logoImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && LOGO_IMAGE_HOST.test(parsed.hostname) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

type ImageInfo = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };

/** The type and size of a PNG, JPEG or WebP, read from its bytes. Null for anything else. */
function imageInfo(b: Buffer): ImageInfo | null {
  if (b.length >= 24 && b.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // Width and height are the first two fields of the IHDR chunk.
    return { mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Walk the segments to the frame header, which carries the size.
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { mime: 'image/webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      return {
        mime: 'image/webp',
        width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      };
    }
    if (chunk === 'VP8X') return { mime: 'image/webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

/** An image fit for the card: a known type, not oversized, at least MIN_LOGO_PX square. */
function usableImage(b: Buffer): ImageInfo | null {
  if (b.length > MAX_LOGO_BYTES) return null;
  const info = imageInfo(b);
  return info && Math.min(info.width, info.height) >= MIN_LOGO_PX ? info : null;
}

/** A usable PNG — what Google's icons and Logo.dev's downloads are asked for. */
function usablePng(b: Buffer): Buffer | null {
  return usableImage(b)?.mime === 'image/png' ? b : null;
}
