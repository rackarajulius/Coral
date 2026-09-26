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
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v !== undefined && v !== '') body.set(k, String(v));
    }
    return this.request<T>(path, { method: 'POST', body: body.toString() });
  }

  async get<T = Record<string, unknown>>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const key = this.secretKey();
    const res = await fetch(`${this.apiUrl()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        /**
         * Pinning the version means Stripe changing a field shape does not
         * silently change what our webhooks read. Overridable so an upgrade is
         * a config change rather than a deploy.
         */
        'Stripe-Version': this.config.get<string>('STRIPE_API_VERSION', '2024-06-20'),
      },
      body: init.body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Stripe ${init.method} ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
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
