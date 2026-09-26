import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { User } from '../common/types/user.types';

export const WEBHOOK_EVENTS = ['screening.completed', 'screening.declined'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Consecutive failures before an endpoint is auto-disabled. */
const MAX_FAILURES = 20;
const TIMEOUT_MS = 10_000;

/**
 * Outbound webhooks — how this platform integrates with an ATS.
 *
 * Native connectors (Greenhouse, Lever, Ashby, Workday) each need partner
 * credentials and a live tenant to build and test against. A signed webhook
 * needs neither, works with every ATS, and drops straight into whatever iPaaS
 * or middleware a customer already runs.
 *
 * Deliveries are best-effort and never block the candidate: a screening is
 * finished whether or not the employer's endpoint is reachable.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly audit: CompanyAuditService,
  ) {}

  /* -------------------------------- CRUD --------------------------------- */

  async list(employer: User) {
    const rows = await this.prisma.employerWebhook.findMany({
      // Endpoint configuration is company-level: a webhook must not vanish
      // because the person who added it left.
      where: { employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.shape(r));
  }

  async create(employer: User, input: { url: string; events?: string[] }) {
    this.assertSafeUrl(input.url);
    const events = this.validEvents(input.events);
    const created = await this.prisma.employerWebhook.create({
      data: {
        employerId: employer.id,
        url: input.url,
        secret: randomBytes(32).toString('hex'),
        events,
      },
    });
    void this.audit.recordFor(employer, {
      category: 'INTEGRATIONS',
      action: 'Added a webhook',
      entityType: 'Webhook',
      entityId: created.id,
      entityName: created.url,
      summary: `Added a webhook endpoint (${events.join(', ') || 'no events'})`,
    });

    // The only time the secret is returned: receivers need it to verify, and
    // it is never readable again.
    return { ...this.shape(created), secret: created.secret };
  }

  async remove(employer: User, id: string) {
    const { count } = await this.prisma.employerWebhook.deleteMany({
      where: { id, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (count === 0) throw new NotFoundException('Webhook not found');
    void this.audit.recordFor(employer, {
      category: 'INTEGRATIONS',
      action: 'Removed a webhook',
      entityType: 'Webhook',
      entityId: id,
      summary: 'Removed a webhook endpoint',
    });
    return { removed: true };
  }

  /** Sends a sample payload so a receiver can be verified before going live. */
  async test(employer: User, id: string) {
    const hook = await this.prisma.employerWebhook.findFirst({
      where: { id, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!hook) throw new NotFoundException('Webhook not found');
    const result = await this.deliver(hook, 'screening.completed', {
      test: true,
      message: 'Test delivery from Coral. No candidate data is included.',
    });
    return result;
  }

  /* ------------------------------ delivery ------------------------------- */

  /**
   * Fires an event to every matching endpoint. Never throws — a broken
   * customer endpoint must not fail the action that triggered it.
   */
  async emit(employerId: string, event: WebhookEvent, payload: Record<string, unknown>) {
    try {
      const hooks = await this.prisma.employerWebhook.findMany({
        where: { employerId, active: true, events: { has: event } },
      });
      await Promise.allSettled(hooks.map((h) => this.deliver(h, event, payload)));
    } catch (err) {
      this.logger.warn(`Webhook emit failed for ${event}: ${(err as Error).message}`);
    }
  }

  private async deliver(
    hook: { id: string; url: string; secret: string; failureCount: number },
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number | null; error: string | null }> {
    const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data: payload });
    const signature = createHmac('sha256', hook.secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let status: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Coral-Event': event,
          'X-Coral-Signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
        redirect: 'error', // a redirect could point anywhere; don't follow it
      });
      status = res.status;
      if (!res.ok) error = `Endpoint returned ${res.status}`;
    } catch (err) {
      error = (err as Error).name === 'AbortError' ? 'Timed out' : (err as Error).message;
    } finally {
      clearTimeout(timeout);
    }

    const ok = !error;
    const failureCount = ok ? 0 : hook.failureCount + 1;
    await this.prisma.employerWebhook
      .update({
        where: { id: hook.id },
        data: {
          lastStatus: status,
          lastError: error?.slice(0, 500) ?? null,
          lastAttemptAt: new Date(),
          failureCount,
          // Stop hammering an endpoint that has been dead for a long time.
          ...(failureCount >= MAX_FAILURES ? { active: false } : {}),
        },
      })
      .catch(() => undefined);

    return { ok, status, error };
  }

  /* ------------------------------ validation ----------------------------- */

  /**
   * Rejects anything that isn't a public HTTPS URL.
   *
   * A user-supplied URL that the server fetches is an SSRF primitive: without
   * this, an employer could point a webhook at localhost or a cloud metadata
   * endpoint and have the server fetch it with our network position.
   */
  private assertSafeUrl(raw: string) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('That is not a valid URL.');
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('Webhook URLs must use https.');
    }

    const host = url.hostname.toLowerCase();
    const blocked =
      host === 'localhost' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      // IPv4 private / loopback / link-local ranges, including the AWS and GCP
      // metadata address 169.254.169.254.
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^0\./.test(host);

    if (blocked) {
      throw new BadRequestException('Webhook URLs must point at a public address.');
    }
  }

  private validEvents(events?: string[]): string[] {
    const chosen = (events ?? []).filter((e) =>
      (WEBHOOK_EVENTS as readonly string[]).includes(e),
    );
    // Subscribing to nothing would silently never fire.
    return chosen.length > 0 ? [...new Set(chosen)] : ['screening.completed'];
  }

  /** Never returns the secret — it is shown once, at creation. */
  private shape(r: {
    id: string; url: string; events: string[]; active: boolean;
    lastStatus: number | null; lastError: string | null; lastAttemptAt: Date | null;
    failureCount: number; createdAt: Date;
  }) {
    return {
      id: r.id,
      url: r.url,
      events: r.events,
      active: r.active,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
      lastAttemptAt: r.lastAttemptAt,
      failureCount: r.failureCount,
      createdAt: r.createdAt,
    };
  }

  /** Reference implementation of the check a receiver should perform. */
  static verifySignature(body: string, secret: string, header: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(header ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
