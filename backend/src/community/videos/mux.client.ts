import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const API = 'https://api.mux.com/video/v1';

/** A direct upload, as Mux reports it. */
export interface MuxUpload {
  id: string;
  url: string;
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out' | string;
  asset_id?: string;
  error?: { type?: string; message?: string };
}

/** A video asset, as Mux reports it. */
export interface MuxAsset {
  id: string;
  status: 'preparing' | 'ready' | 'errored' | string;
  /** Seconds. */
  duration?: number;
  aspect_ratio?: string;
  playback_ids?: Array<{ id: string; policy: string }>;
  errors?: { type?: string; messages?: string[] };
}

/**
 * Mux's video API, over plain HTTPS.
 *
 * Only what community videos need: a direct upload the browser sends the file
 * to, reading where it got to, and deleting. Off — and saying so — until
 * MUX_TOKEN_ID and MUX_TOKEN_SECRET are set, so the rest of the app runs
 * without a Mux account.
 */
@Injectable()
export class MuxClient {
  private readonly logger = new Logger(MuxClient.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!(this.config.get<string>('MUX_TOKEN_ID') && this.config.get<string>('MUX_TOKEN_SECRET'));
  }

  /**
   * An upload URL for one file, for the browser at `corsOrigin`.
   *
   * Basic quality, which Mux encodes for free, streamed publicly — posts are
   * public — and capped at 1080p, which is what a feed shows anyway.
   */
  async createUpload(input: { corsOrigin: string; passthrough: string }): Promise<MuxUpload> {
    return this.request<MuxUpload>('POST', '/uploads', {
      cors_origin: input.corsOrigin,
      // An hour to start sending: a picked file starts at once, so an upload
      // URL nobody used by then is abandoned.
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ['public'],
        video_quality: 'basic',
        max_resolution_tier: '1080p',
        passthrough: input.passthrough,
      },
    });
  }

  getUpload(id: string): Promise<MuxUpload> {
    return this.request<MuxUpload>('GET', `/uploads/${encodeURIComponent(id)}`);
  }

  getAsset(id: string): Promise<MuxAsset> {
    return this.request<MuxAsset>('GET', `/assets/${encodeURIComponent(id)}`);
  }

  /** Gone already counts as done. */
  async deleteAsset(id: string): Promise<void> {
    await this.request('DELETE', `/assets/${encodeURIComponent(id)}`, undefined, [404]);
  }

  /** An upload nobody finished, closed so its URL stops working. */
  async cancelUpload(id: string): Promise<void> {
    // 400 is "it already finished or was cancelled", which is the point.
    await this.request('PUT', `/uploads/${encodeURIComponent(id)}/cancel`, undefined, [400, 404]);
  }

  /**
   * Whether a webhook really came from Mux: `Mux-Signature: t=…,v1=…`, an
   * HMAC-SHA256 of "<t>.<raw body>" with the endpoint's signing secret, sent
   * within the last five minutes (Mux's own SDKs' tolerance).
   */
  verifyWebhook(rawBody: string, header: string | undefined, now = Date.now()): boolean {
    const secret = this.config.get<string>('MUX_WEBHOOK_SECRET');
    if (!secret || !header) return false;
    const parts = Object.fromEntries(
      header.split(',').map((part) => {
        const at = part.indexOf('=');
        return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
      }),
    );
    const t = Number(parts.t);
    const signature = parts.v1;
    if (!Number.isFinite(t) || !signature || Math.abs(now / 1000 - t) > 300) return false;
    const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async request<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    if (!this.enabled) throw new ServiceUnavailableException('Video uploads are not set up yet.');
    const auth = Buffer.from(
      `${this.config.get<string>('MUX_TOKEN_ID')}:${this.config.get<string>('MUX_TOKEN_SECRET')}`,
    ).toString('base64');
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (okStatuses.includes(res.status)) return undefined as T;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Logged in full for us; the person is told something they can act on.
      this.logger.error(`Mux ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('The video service did not answer. Try again in a moment.');
    }
    if (res.status === 204) return undefined as T;
    return ((await res.json()) as { data: T }).data;
  }
}
