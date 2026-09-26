import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAuditService } from '../company/company-audit.service';
import type { MeetEvent } from './google-calendar.service';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';

/**
 * `offline_access` is what yields a refresh token; without it the connection
 * dies within the hour. `Calendars.ReadWrite` is enough to create an event
 * *and* its Teams meeting — no separate OnlineMeetings grant is needed, which
 * keeps the consent screen smaller.
 */
const SCOPES = 'openid email offline_access User.Read Calendars.ReadWrite';

/**
 * Microsoft 365 calendar, and Teams meetings with it.
 *
 * Mirrors GoogleCalendarService on purpose — same methods, same return type —
 * so CalendarService can hold both behind one interface and the interview flow
 * never learns which provider an employer uses.
 */
@Injectable()
export class MicrosoftCalendarService {
  private readonly logger = new Logger(MicrosoftCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: CompanyAuditService,
  ) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>('MICROSOFT_CLIENT_ID') &&
      !!this.config.get<string>('MICROSOFT_CLIENT_SECRET')
    );
  }

  async getConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
    const row = await this.prisma.microsoftCredential.findUnique({ where: { userId } });
    return { connected: !!row, email: row?.microsoftEmail ?? null };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.microsoftCredential.deleteMany({ where: { userId } });
    void this.audit.recordForUserId(userId, {
      category: 'INTEGRATIONS',
      action: 'Disconnected Outlook & Teams',
      entityType: 'Integration',
      entityId: 'microsoft',
      summary: 'Disconnected Outlook & Teams',
    });
  }

  authUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('MICROSOFT_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.redirectUri(),
      response_mode: 'query',
      scope: SCOPES,
      state: userId,
      // Forces a refresh token even when the user has consented before.
      prompt: 'consent',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Exchanges the code, stores the refresh token, returns where to send the browser. */
  async handleCallback(code: string, state: string): Promise<string> {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    const back = (result: string) => `${frontend}/employers/integrations?microsoft=${result}`;
    if (!code || !state) return back('error');

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.get<string>('MICROSOFT_CLIENT_ID')!,
          client_secret: this.config.get<string>('MICROSOFT_CLIENT_SECRET')!,
          code,
          redirect_uri: this.redirectUri(),
          grant_type: 'authorization_code',
        }),
      });

      const data = (await res.json()) as {
        refresh_token?: string;
        access_token?: string;
        error_description?: string;
      };
      if (!data.refresh_token) {
        this.logger.warn(`Microsoft token exchange returned no refresh token: ${data.error_description ?? ''}`);
        return back('error');
      }

      const email = data.access_token ? await this.emailFor(data.access_token) : null;

      await this.prisma.microsoftCredential.upsert({
        where: { userId: state },
        create: { userId: state, refreshToken: data.refresh_token, microsoftEmail: email },
        update: { refreshToken: data.refresh_token, microsoftEmail: email },
      });
      void this.audit.recordForUserId(state, {
        category: 'INTEGRATIONS',
        action: 'Connected Outlook & Teams',
        entityType: 'Integration',
        entityId: 'microsoft',
        summary: `Connected Outlook & Teams${email ? ` (${email})` : ''}`,
      });
      return back('connected');
    } catch (err) {
      this.logger.error(`Microsoft callback failed: ${(err as Error).message}`);
      return back('error');
    }
  }

  /**
   * Creates the event and its Teams meeting in one call.
   *
   * Returns null rather than throwing on every failure path: an interview is
   * scheduled whether or not a calendar was reachable, and losing the booking
   * because Microsoft was down would be the worse outcome.
   */
  async createTeamsEvent(
    ownerUserId: string,
    input: {
      summary: string;
      description?: string;
      startISO: string;
      durationMinutes?: number;
      attendees: string[];
      /** A link made elsewhere (Zoom); the event carries it instead of Teams. */
      existingLink?: string;
    },
  ): Promise<MeetEvent | null> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return null;

      const start = new Date(input.startISO);
      const end = new Date(start.getTime() + (input.durationMinutes ?? 45) * 60_000);

      const res = await fetch(`${GRAPH}/me/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: input.summary,
          body: input.existingLink
            ? {
                contentType: 'text',
                content: [input.description, `Join: ${input.existingLink}`]
                  .filter(Boolean)
                  .join('\n\n'),
              }
            : input.description
              ? { contentType: 'text', content: input.description }
              : undefined,
          location: input.existingLink ? { displayName: input.existingLink } : undefined,
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
          attendees: input.attendees.map((address) => ({
            emailAddress: { address },
            type: 'required',
          })),
          // This pair is what turns the event into a Teams meeting and returns
          // a join URL — no separate meeting API call. Skipped when Zoom
          // already supplied one, so the invitation carries a single link.
          isOnlineMeeting: !input.existingLink,
          ...(input.existingLink ? {} : { onlineMeetingProvider: 'teamsForBusiness' }),
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Microsoft event creation failed: HTTP ${res.status}`);
        return null;
      }

      const event = (await res.json()) as {
        id?: string;
        onlineMeeting?: { joinUrl?: string };
      };
      const link = input.existingLink ?? event.onlineMeeting?.joinUrl;
      if (!event.id || !link) return null;

      return { meetLink: link, eventId: event.id };
    } catch (err) {
      this.logger.warn(`Microsoft event creation failed: ${(err as Error).message}`);
      return null;
    }
  }

  async deleteEvent(ownerUserId: string, eventId: string): Promise<void> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return;
      await fetch(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // A stale calendar entry is not worth failing a cancellation over.
      this.logger.warn(`Microsoft event deletion failed: ${(err as Error).message}`);
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  private redirectUri(): string {
    const base = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001/api/v1');
    return `${base}/integrations/microsoft/callback`;
  }

  private async emailFor(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return null;
      const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
      return me.mail ?? me.userPrincipalName ?? null;
    } catch {
      return null;
    }
  }

  /** Trades the stored refresh token for a short-lived access token. */
  private async accessTokenFor(userId: string): Promise<string | null> {
    const row = await this.prisma.microsoftCredential.findUnique({ where: { userId } });
    if (!row) return null;

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.get<string>('MICROSOFT_CLIENT_ID')!,
          client_secret: this.config.get<string>('MICROSOFT_CLIENT_SECRET')!,
          refresh_token: row.refreshToken,
          grant_type: 'refresh_token',
          scope: SCOPES,
        }),
      });

      const data = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!data.access_token) {
        // A revoked or expired grant will never recover; drop it so the UI
        // shows "not connected" instead of failing silently every booking.
        this.logger.warn(`Microsoft refresh failed for ${userId}; clearing the connection.`);
        await this.disconnect(userId);
        return null;
      }

      // Microsoft rotates refresh tokens: keeping the old one would break the
      // connection on some future refresh, long after the cause.
      if (data.refresh_token && data.refresh_token !== row.refreshToken) {
        await this.prisma.microsoftCredential
          .update({ where: { userId }, data: { refreshToken: data.refresh_token } })
          .catch(() => undefined);
      }

      return data.access_token;
    } catch (err) {
      this.logger.warn(`Microsoft token refresh failed: ${(err as Error).message}`);
      return null;
    }
  }
}
