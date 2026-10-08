import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService, type MeetEvent } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { ZoomService } from './zoom.service';

export type CalendarProvider = 'google' | 'microsoft';

export interface CreatedMeeting extends MeetEvent {
  /** Which calendar holds the event, or null when none is connected. */
  provider: CalendarProvider | null;
  /** Set when Zoom supplied the link — a second object to clean up on cancel. */
  zoomMeetingId: string | null;
}

/**
 * Whichever calendar the employer actually connected.
 *
 * The interview flow used to call Google directly. Adding a second provider
 * that way would have meant an if/else at every call site, and a third would
 * have meant editing all of them again — so the choice lives here instead and
 * the caller just asks for a meeting.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleCalendarService,
    private readonly microsoft: MicrosoftCalendarService,
    private readonly zoom: ZoomService,
  ) {}

  /** Which provider this user has connected, or null. */
  async providerFor(userId: string): Promise<CalendarProvider | null> {
    const [google, microsoft] = await Promise.all([
      this.prisma.googleCredential.findUnique({ where: { userId }, select: { userId: true } }),
      this.prisma.microsoftCredential.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    // Google wins when somebody has both — it was there first, so existing
    // bookings keep landing where their owner expects.
    if (google) return 'google';
    if (microsoft) return 'microsoft';
    return null;
  }

  /**
   * Creates a calendar event with a video link, or returns null when no
   * calendar is connected. Null is a normal outcome, not an error: an interview
   * is booked whether or not a calendar was available.
   */
  async createMeeting(
    ownerUserId: string,
    input: {
      summary: string;
      description?: string;
      startISO: string;
      durationMinutes?: number;
      attendees: string[];
    },
  ): Promise<CreatedMeeting | null> {
    // Zoom first, because it decides which link the event should carry.
    const zoom = await this.zoom
      .createMeeting(ownerUserId, {
        topic: input.summary,
        startISO: input.startISO,
        durationMinutes: input.durationMinutes,
        agenda: input.description,
      })
      .catch(() => null);

    const provider = await this.providerFor(ownerUserId);

    // Zoom without a calendar is still a usable interview: the platform emails
    // an .ics either way, so the link alone is worth returning.
    if (!provider) {
      return zoom
        ? { meetLink: zoom.joinUrl, eventId: '', provider: null, zoomMeetingId: zoom.meetingId }
        : null;
    }

    const withLink = { ...input, existingLink: zoom?.joinUrl };
    const event =
      provider === 'google'
        ? await this.google.createMeetEvent(ownerUserId, withLink).catch(() => null)
        : await this.microsoft.createTeamsEvent(ownerUserId, withLink).catch(() => null);

    if (!event) {
      // The calendar failed but Zoom did not — keep the link rather than
      // dropping a meeting that already exists on Zoom's side.
      return zoom
        ? { meetLink: zoom.joinUrl, eventId: '', provider: null, zoomMeetingId: zoom.meetingId }
        : null;
    }

    return { ...event, provider, zoomMeetingId: zoom?.meetingId ?? null };
  }

  /**
   * Deletes by the provider that created it, not by whatever is connected now.
   *
   * Someone who switches provider after booking would otherwise have the delete
   * sent to the wrong API, leaving a stale event with a dead join link in the
   * attendees' calendars.
   */
  async deleteMeeting(
    ownerUserId: string,
    eventId: string | null,
    provider: string | null,
    zoomMeetingId?: string | null,
  ): Promise<void> {
    // Two systems may hold something: the calendar event and, separately, the
    // Zoom meeting. Cleaning up one and not the other leaves a live meeting
    // room or a calendar entry pointing at a deleted one.
    if (zoomMeetingId) await this.zoom.deleteMeeting(ownerUserId, zoomMeetingId);

    if (!eventId) return;
    const target = provider ?? (await this.providerFor(ownerUserId));
    if (target === 'microsoft') return this.microsoft.deleteEvent(ownerUserId, eventId);
    if (target === 'google') return this.google.deleteEvent(ownerUserId, eventId);
  }
}
