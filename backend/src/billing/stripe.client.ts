import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The slice of Stripe's REST API that subscriptions need.
 *
 * Deliberately small and untyped-at-the-edge: Stripe's objects are wide and we
 * read a handful of fields from each. PaymentsService keeps its own calls for
 * one-off charges — that code works and is not worth destabilising to share a
 * helper this thin.
 */
@Injectable()
export class StripeClient {
  private readonly defaultApiUrl = 'https://api.stripe.com/v1';

  constructor(private readonly config: ConfigService) {}

  /** True when the keys are present. Lets callers degrade instead of throwing. */
  get configured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY', '').trim());
  }

  async post<T = Record<string, unknown>>(
    path: string,
    form: Record<string, string | number | undefined>,
    idempotencyKey?: string,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v !== undefined && v !== '') body.set(k, String(v));
    }
    return this.request<T>(path, { method: 'POST', body: body.toString(), idempotencyKey });
  }

  async get<T = Record<string, unknown>>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async delete<T = Record<string, unknown>>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private async request<T>(path: string, init: { method: string; body?: string; idempotencyKey?: string }): Promise<T> {
    const key = this.secretKey();
    const res = await fetch(`${this.apiUrl()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
        /**
         * Pinning the version means Stripe changing a field shape does not
         * silently change what our webhooks read. Overridable so an upgrade is
         * a config change rather than a deploy.
         */
        'Stripe-Version': this.config.get<string>('STRIPE_API_VERSION', '2024-06-20'),
      },
      body: init.body,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => { throw new BadGatewayException('Billing provider is unavailable. Please try again.'); });

    if (!res.ok) {
      /**
       * Stripe says exactly what is wrong — "You must have a valid head office
       * address to enable automatic tax calculation", "Tax ID collection
       * requires updating business name on the customer" — and this used to
       * discard it, leaving a bare 502 in the browser and nothing anywhere
       * else. Diagnosing one cost a reproduction against the live API.
       *
       * `console.error` rather than Nest's Logger on purpose: main.ts creates
       * the app with `logger: false`, so a Logger call here prints nothing.
       */
      const detail = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        `[stripe] ${init.method} ${path} failed (${res.status}): ${detail.slice(0, 500)}`,
      );
      throw new BadGatewayException(
        `Billing provider request failed (${res.status}). Please try again.`,
      );
    }
    return (await res.json().catch(() => { throw new BadGatewayException('Billing provider returned an invalid response.'); })) as T;
  }

  private secretKey(): string {
    const value = this.config.get<string>('STRIPE_SECRET_KEY', '').trim();
    if (!value) {
      throw new ServiceUnavailableException(
        'Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env',
      );
    }
    return value;
  }

  private apiUrl(): string {
    return this.config.get<string>('STRIPE_API_URL', this.defaultApiUrl).replace(/\/+$/, '');
  }
}
