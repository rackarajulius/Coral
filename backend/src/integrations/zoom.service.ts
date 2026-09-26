import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAuditService } from '../company/company-audit.service';

const AUTH_URL = 'https://zoom.us/oauth/authorize';
const TOKEN_URL = 'https://zoom.us/oauth/token';
const API = 'https://api.zoom.us/v2';

export interface ZoomMeeting {
  joinUrl: string;
  meetingId: string;
}

/**
 * Zoom — a meeting provider, not a calendar.
 *
 * Google and Microsoft create an event *and* embed their own video link. Zoom
 * only makes the meeting, so it composes with a calendar rather than replacing
 * one: the join URL goes into whichever event the employer's calendar creates,
 * and stands alone when no calendar is connected.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: CompanyAuditService,
  ) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ZOOM_CLIENT_ID') && !!this.config.get<string>('ZOOM_CLIENT_SECRET');
  }

  async getConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
    const row = await this.prisma.zoomCredential.findUnique({ where: { userId } });
    return { connected: !!row, email: row?.zoomEmail ?? null };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.zoomCredential.deleteMany({ where: { userId } });
    void this.audit.recordForUserId(userId, {
      category: 'INTEGRATIONS',
      action: 'Disconnected Zoom',
      entityType: 'Integration',
      entityId: 'zoom',
      summary: 'Disconnected Zoom',
    });
  }

  authUrl(userId: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get<string>('ZOOM_CLIENT_ID')!,
      redirect_uri: this.redirectUri(),
      state: userId,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    const back = (result: string) => `${frontend}/employers/integrations?zoom=${result}`;
    if (!code || !state) return back('error');

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri(),
        }),
      });

      const data = (await res.json()) as { refresh_token?: string; access_token?: string };
      if (!data.refresh_token) {
        this.logger.warn('Zoom token exchange returned no refresh token');
        return back('error');
      }

      const email = data.access_token ? await this.emailFor(data.access_token) : null;
      await this.prisma.zoomCredential.upsert({
        where: { userId: state },
        create: { userId: state, refreshToken: data.refresh_token, zoomEmail: email },
        update: { refreshToken: data.refresh_token, zoomEmail: email },
      });
      void this.audit.recordForUserId(state, {
        category: 'INTEGRATIONS',
        action: 'Connected Zoom',
        entityType: 'Integration',
        entityId: 'zoom',
        summary: `Connected Zoom${email ? ` (${email})` : ''}`,
      });
      return back('connected');
    } catch (err) {
      this.logger.error(`Zoom callback failed: ${(err as Error).message}`);
      return back('error');
    }
  }

  /**
   * Creates a scheduled meeting. Null on any failure — an interview is booked
   * whether or not Zoom was reachable.
   */
  async createMeeting(
    ownerUserId: string,
    input: { topic: string; startISO: string; durationMinutes?: number; agenda?: string },
  ): Promise<ZoomMeeting | null> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return null;

      const res = await fetch(`${API}/users/me/meetings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: input.topic,
          type: 2, // scheduled, fixed time
          start_time: new Date(input.startISO).toISOString(),
          duration: input.durationMinutes ?? 45,
          timezone: 'UTC',
          agenda: input.agenda,
          settings: {
            // The candidate should be able to arrive first without being stuck
            // in a waiting room nobody is watching.
            join_before_host: true,
            waiting_room: false,
          },
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Zoom meeting creation failed: HTTP ${res.status}`);
        return null;
      }
      const meeting = (await res.json()) as { id?: number | string; join_url?: string };
      if (!meeting.id || !meeting.join_url) return null;
      return { joinUrl: meeting.join_url, meetingId: String(meeting.id) };
    } catch (err) {
      this.logger.warn(`Zoom meeting creation failed: ${(err as Error).message}`);
      return null;
    }
  }

  async deleteMeeting(ownerUserId: string, meetingId: string): Promise<void> {
    try {
      const token = await this.accessTokenFor(ownerUserId);
      if (!token) return;
      await fetch(`${API}/meetings/${encodeURIComponent(meetingId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // A leftover Zoom meeting is not worth failing a cancellation over.
      this.logger.warn(`Zoom meeting deletion failed: ${(err as Error).message}`);
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  private redirectUri(): string {
    const base = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001/api/v1');
    return `${base}/integrations/zoom/callback`;
  }

  private basicAuth(): string {
    const id = this.config.get<string>('ZOOM_CLIENT_ID') ?? '';
    const secret = this.config.get<string>('ZOOM_CLIENT_SECRET') ?? '';
    return Buffer.from(`${id}:${secret}`).toString('base64');
  }

  private async emailFor(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const me = (await res.json()) as { email?: string };
      return me.email ?? null;
    } catch {
      return null;
    }
  }

  private async accessTokenFor(userId: string): Promise<string | null> {
    const row = await this.prisma.zoomCredential.findUnique({ where: { userId } });
    if (!row) return null;

    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refreshToken }),
      });

      const data = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!data.access_token) {
        this.logger.warn(`Zoom refresh failed for ${userId}; clearing the connection.`);
        await this.disconnect(userId);
        return null;
      }

      // Zoom rotates refresh tokens on every use and invalidates the old one
      // immediately. Failing to persist the new one breaks the connection on
      // the *next* booking, with nothing to point at as the cause.
      if (data.refresh_token && data.refresh_token !== row.refreshToken) {
        await this.prisma.zoomCredential
          .update({ where: { userId }, data: { refreshToken: data.refresh_token } })
          .catch(() => undefined);
      }

      return data.access_token;
    } catch (err) {
      this.logger.warn(`Zoom token refresh failed: ${(err as Error).message}`);
      return null;
    }
  }
}
