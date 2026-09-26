import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';

export interface MeetEvent {
  meetLink: string;
  eventId: string;
}

/**
 * Per-user Google Calendar connection. An employer connects once (OAuth,
 * offline access); confirmed video interviews then get a real Google Meet link
 * via a Calendar event, with both parties invited. Config-gated on
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — everything degrades gracefully.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('GOOGLE_CLIENT_ID') && !!this.config.get<string>('GOOGLE_CLIENT_SECRET');
  }

  async getConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
    const cred = await this.prisma.googleCredential.findUnique({ where: { userId } });
    return { connected: !!cred, email: cred?.googleEmail ?? null };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.googleCredential.deleteMany({ where: { userId } });
  }

  /* ------------------------------ OAuth flow ----------------------------- */

  private redirectUri(): string {
    const base = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001/api/v1');
    return `${base.replace(/\/$/, '')}/integrations/google/callback`;
  }

  /** HMAC-signed state so the unauthenticated callback can trust the userId. */
  private signState(userId: string): string {
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    const sig = createHmac('sha256', secret).update(userId).digest('hex');
    return `${userId}.${sig}`;
  }

  private verifyState(state: string): string {
    const [userId, sig] = (state || '').split('.');
    if (!userId || !sig) throw new BadRequestException('Invalid state');
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    const expected = createHmac('sha256', secret).update(userId).digest('hex');
    if (sig !== expected) throw new BadRequestException('Invalid state');
    return userId;
  }

  getConnectUrl(userId: string): string {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google integration is not configured');
    }
    const params = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent', // ensure a refresh_token is issued on reconnects
      state: this.signState(userId),
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Exchanges the OAuth code and stores the refresh token. Returns the userId. */
  async handleCallback(code: string, state: string): Promise<string> {
    const userId = this.verifyState(state);

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      this.logger.warn(`Google token exchange failed: HTTP ${res.status}`);
      throw new BadRequestException('Google authorization failed');
    }
    const tokens = (await res.json()) as { refresh_token?: string; id_token?: string };
    if (!tokens.refresh_token) {
      throw new BadRequestException('Google did not return a refresh token — try disconnecting and reconnecting.');
    }

    await this.prisma.googleCredential.upsert({
      where: { userId },
      create: { userId, refreshToken: tokens.refresh_token, googleEmail: this.emailFromIdToken(tokens.id_token) },
      update: { refreshToken: tokens.refresh_token, googleEmail: this.emailFromIdToken(tokens.id_token) },
    });
    return userId;
  }

  /** Best-effort email claim from the id_token (display only — not a credential). */
  private emailFromIdToken(idToken?: string): string | null {
    try {
      if (!idToken) return null;
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
      return typeof payload.email === 'string' ? payload.email : null;
    } catch {
      return null;
    }
  }

  private async accessTokenFor(userId: string): Promise<string | null> {
    const cred = await this.prisma.googleCredential.findUnique({ where: { userId } });
    if (!cred) return null;

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: cred.refreshToken,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      // Revoked/expired grant — drop it so the UI shows "connect" again.
      if (res.status === 400 || res.status === 401) {
        this.logger.warn(`Google refresh token invalid for user ${userId} — disconnecting.`);
        await this.disconnect(userId);
      }
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  }

  /* --------------------------- Calendar / Meet --------------------------- */

  /**
   * Creates a Calendar event with a Google Meet link on the owner's primary
   * calendar, inviting the attendees (Google emails them the invite).
   * Returns null when the owner isn't connected or the API call fails.
   */
  async createMeetEvent(
    ownerUserId: string,
    input: {
      summary: string;
      description?: string;
      startISO: string;
      durationMinutes?: number;
      attendees: string[];
      /**
       * A link made elsewhere (Zoom). When present the event carries it rather
       * than requesting a Meet — asking for both would put two different join
       * links on one invitation.
       */
      existingLink?: string;
    },
  ): Promise<MeetEvent | null> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return null;

      const start = new Date(input.startISO);
      const end = new Date(start.getTime() + (input.durationMinutes ?? 45) * 60_000);

      const res = await fetch(`${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.summary,
          description: input.existingLink
            ? [input.description, `Join: ${input.existingLink}`].filter(Boolean).join('\n\n')
            : input.description || undefined,
          location: input.existingLink || undefined,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: input.attendees.filter(Boolean).map((email) => ({ email })),
          ...(input.existingLink
            ? {}
            : {
                conferenceData: {
                  createRequest: {
                    requestId: randomUUID(),
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                  },
                },
              }),
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Calendar event create failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
        return null;
      }
      const event = (await res.json()) as {
        id?: string;
        hangoutLink?: string;
        conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
      };
      const meetLink =
        input.existingLink ??
        event.hangoutLink ??
        event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
        null;
      if (!meetLink || !event.id) return null;
      return { meetLink, eventId: event.id };
    } catch (err) {
      this.logger.warn(`createMeetEvent failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /** Best-effort event deletion (interview cancelled). */
  async deleteEvent(ownerUserId: string, eventId: string): Promise<void> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return;
      await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      this.logger.warn(`deleteEvent failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
