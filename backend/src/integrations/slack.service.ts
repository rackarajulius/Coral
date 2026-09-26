import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { User } from '../common/types/user.types';

/** Only what an incoming webhook needs — no read access to anything. */
const SCOPES = 'incoming-webhook';
const STATE_TTL_MS = 10 * 60 * 1000;
const POST_TIMEOUT_MS = 8_000;

export interface SlackMessage {
  title: string;
  /** Kept free of candidate names — see notify(). */
  body: string;
  /** Path within the app, e.g. /employers/candidates. */
  link?: string;
}

/**
 * Slack, for team notifications.
 *
 * Connected per company rather than per person, and deliberately using an
 * incoming webhook rather than a bot token: Slack binds the webhook to one
 * channel at install time, it does not expire, and it can only post. A bot
 * token would be a much larger grant for the one thing this does.
 */
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly config: ConfigService,
    private readonly audit: CompanyAuditService,
  ) {}

  /** False when this deployment has no Slack app — the UI says "not enabled". */
  isConfigured(): boolean {
    return !!this.config.get<string>('SLACK_CLIENT_ID') && !!this.config.get<string>('SLACK_CLIENT_SECRET');
  }

  async status(user: User) {
    const configured = this.isConfigured();
    const context = await this.companyContext.forUser(user.id);
    if (!context) return { configured, connected: false, channel: null, team: null, lastError: null };

    const row = await this.prisma.slackIntegration.findUnique({
      where: { companyId: context.companyId },
      select: { channelName: true, teamName: true, lastError: true },
    });

    return {
      configured,
      connected: !!row,
      channel: row?.channelName ?? null,
      team: row?.teamName ?? null,
      lastError: row?.lastError ?? null,
    };
  }

  /**
   * Builds the install URL.
   *
   * `state` is signed rather than stored: it carries the company id and a
   * timestamp under an HMAC, so the callback can verify who started the flow
   * without a session, and a replayed link expires on its own.
   */
  async authUrl(user: User): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Slack is not enabled on this deployment.');
    }
    const context = await this.companyContext.assertCanManageMembers(user.id);

    const payload = `${context.companyId}.${user.id}.${Date.now()}.${randomBytes(8).toString('hex')}`;
    const state = `${payload}.${this.sign(payload)}`;

    const params = new URLSearchParams({
      client_id: this.config.get<string>('SLACK_CLIENT_ID')!,
      scope: SCOPES,
      redirect_uri: this.redirectUri(),
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /** Exchanges the code and stores the webhook. Returns where to send the browser. */
  async handleCallback(code: string, state: string): Promise<string> {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    const back = (result: string) => `${frontend}/employers/integrations?slack=${result}`;

    const parsed = this.verifyState(state);
    if (!parsed) {
      this.logger.warn('Slack callback with an invalid or expired state');
      return back('error');
    }

    try {
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.get<string>('SLACK_CLIENT_ID')!,
          client_secret: this.config.get<string>('SLACK_CLIENT_SECRET')!,
          code,
          redirect_uri: this.redirectUri(),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        team?: { name?: string };
        incoming_webhook?: { url?: string; channel?: string };
      };

      if (!data.ok || !data.incoming_webhook?.url) {
        this.logger.warn(`Slack OAuth exchange failed: ${data.error ?? 'no webhook returned'}`);
        return back('error');
      }

      // Reconnecting replaces the previous workspace rather than stacking
      // endpoints nobody remembers configuring.
      await this.prisma.slackIntegration.upsert({
        where: { companyId: parsed.companyId },
        create: {
          companyId: parsed.companyId,
          webhookUrl: data.incoming_webhook.url,
          channelName: data.incoming_webhook.channel ?? null,
          teamName: data.team?.name ?? null,
          connectedById: parsed.userId,
        },
        update: {
          webhookUrl: data.incoming_webhook.url,
          channelName: data.incoming_webhook.channel ?? null,
          teamName: data.team?.name ?? null,
          connectedById: parsed.userId,
          lastError: null,
        },
      });

      void this.audit.recordForUserId(parsed.userId, {
        category: 'INTEGRATIONS',
        action: 'Connected Slack',
        entityType: 'Integration',
        entityId: 'slack',
        entityName: data.team?.name ?? 'Slack',
        summary: `Connected Slack${data.incoming_webhook.channel ? ` to ${data.incoming_webhook.channel}` : ''}`,
      });
      return back('connected');
    } catch (err) {
      this.logger.error(`Slack callback failed: ${(err as Error).message}`);
      return back('error');
    }
  }

  async disconnect(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const { count } = await this.prisma.slackIntegration.deleteMany({
      where: { companyId: context.companyId },
    });
    if (count === 0) throw new NotFoundException('Slack is not connected.');
    void this.audit.recordFor(user, {
      category: 'INTEGRATIONS',
      action: 'Disconnected Slack',
      entityType: 'Integration',
      entityId: 'slack',
      summary: 'Disconnected Slack',
    });
    return { disconnected: true };
  }

  /** Posts a sample so someone can confirm the channel before relying on it. */
  async test(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    return this.notify(context.companyId, {
      title: 'Coral is connected',
      body: 'This is a test message. Notifications about your hiring will arrive here.',
    });
  }

  /**
   * Posts to a company's channel. Never throws.
   *
   * **No candidate names, emails or any other personal detail.** A Slack
   * channel is not the app: it can include people who hold no seat here, it is
   * searchable forever, and it leaves the boundary the candidate consented to.
   * Say what happened and link into Coral, where access is still checked.
   */
  async notify(companyId: string, message: SlackMessage): Promise<{ ok: boolean; error?: string }> {
    const row = await this.prisma.slackIntegration.findUnique({ where: { companyId } });
    if (!row) return { ok: false, error: 'not connected' };

    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    const text = message.link
      ? `*${message.title}*\n${message.body}\n<${frontend}${message.link}|Open in Coral>`
      : `*${message.title}*\n${message.body}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
    try {
      const res = await fetch(row.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      const body = await res.text();
      const ok = res.ok && body.trim() === 'ok';
      await this.prisma.slackIntegration.update({
        where: { companyId },
        data: {
          lastPostedAt: new Date(),
          // Recorded rather than logged and forgotten: a revoked webhook fails
          // silently otherwise, and nobody notices the channel went quiet.
          lastError: ok ? null : body.slice(0, 200) || `HTTP ${res.status}`,
        },
      });
      return ok ? { ok: true } : { ok: false, error: body.slice(0, 200) || `HTTP ${res.status}` };
    } catch (err) {
      const error = (err as Error).name === 'AbortError' ? 'Timed out' : (err as Error).message;
      await this.prisma.slackIntegration
        .update({ where: { companyId }, data: { lastError: error.slice(0, 200) } })
        .catch(() => undefined);
      return { ok: false, error };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  private redirectUri(): string {
    const base = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:3001/api/v1';
    return `${base}/integrations/slack/callback`;
  }

  private secret(): string {
    return this.config.get<string>('SLACK_CLIENT_SECRET') ?? 'unconfigured';
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret()).update(payload).digest('hex');
  }

  private verifyState(state: string): { companyId: string; userId: string } | null {
    const parts = (state ?? '').split('.');
    if (parts.length !== 5) return null;
    const [companyId, userId, issuedAt, nonce, signature] = parts;

    const expected = this.sign(`${companyId}.${userId}.${issuedAt}.${nonce}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    // Constant-time: this signature is what stops someone binding their own
    // Slack workspace to another company's id.
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

    return { companyId, userId };
  }
}
