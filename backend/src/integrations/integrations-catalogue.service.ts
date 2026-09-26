import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { SlackService } from './slack.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { ZoomService } from './zoom.service';
import { User } from '../common/types/user.types';

export type IntegrationStatus = 'connected' | 'available' | 'coming_soon' | 'unavailable';

export interface IntegrationEntry {
  key: string;
  name: string;
  category: string;
  description: string;
  /** lucide icon name; the client maps it to a component. */
  icon: string;
  status: IntegrationStatus;
  /** Shown under the card when the status needs explaining. */
  detail: string | null;
}

/**
 * What this platform can actually integrate with.
 *
 * Generated from what is implemented rather than listed in the UI, because a
 * hardcoded list drifts: webhooks shipped — model, signing secret, delivery
 * tracking, and a live `screening.completed` emitter — and sat under "Coming
 * soon" on the settings page the whole time, because nothing tied the label to
 * the code.
 *
 * `unavailable` is deliberately distinct from `coming_soon`: Google Calendar is
 * built, but useless without server credentials. Telling an employer to "come
 * back later" for something an operator can switch on today would be wrong.
 */
@Injectable()
export class IntegrationsCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly config: ConfigService,
    private readonly slack: SlackService,
    private readonly microsoft: MicrosoftCalendarService,
    private readonly zoom: ZoomService,
  ) {}

  async forEmployer(user: User): Promise<IntegrationEntry[]> {
    const memberIds = await this.companyContext.memberUserIds(user.id);

    const googleConfigured =
      !!this.config.get<string>('GOOGLE_CLIENT_ID') &&
      !!this.config.get<string>('GOOGLE_CLIENT_SECRET');

    const [googleCredential, microsoftCredential, zoomCredential, webhookCount, slackRow] = await Promise.all([
      this.prisma.googleCredential.findFirst({
        where: { userId: { in: memberIds } },
        select: { googleEmail: true },
      }),
      this.prisma.microsoftCredential.findFirst({
        where: { userId: { in: memberIds } },
        select: { microsoftEmail: true },
      }),
      this.prisma.zoomCredential.findFirst({
        where: { userId: { in: memberIds } },
        select: { zoomEmail: true },
      }),
      this.prisma.employerWebhook.count({ where: { employerId: { in: memberIds } } }),
      this.companyContext.forUser(user.id).then((ctx) =>
        ctx
          ? this.prisma.slackIntegration.findUnique({
              where: { companyId: ctx.companyId },
              select: { channelName: true, teamName: true },
            })
          : null,
      ),
    ]);

    return [
      {
        key: 'google-calendar',
        name: 'Google Calendar',
        category: 'Calendar',
        description: 'Confirmed interviews get a Meet link and land in your calendar automatically.',
        icon: 'CalendarDays',
        status: !googleConfigured
          ? 'unavailable'
          : googleCredential
            ? 'connected'
            : 'available',
        detail: !googleConfigured
          ? 'Not enabled on this deployment yet.'
          : googleCredential
            ? (googleCredential.googleEmail ?? 'Connected')
            : null,
      },
      {
        key: 'webhooks',
        name: 'Webhooks',
        category: 'Developer',
        description:
          'Signed HTTP callbacks when a screening finishes — drops into any ATS or middleware you already run.',
        icon: 'Webhook',
        status: webhookCount > 0 ? 'connected' : 'available',
        detail:
          webhookCount > 0
            ? `${webhookCount} endpoint${webhookCount === 1 ? '' : 's'}`
            : null,
      },
      {
        key: 'slack',
        name: 'Slack',
        category: 'Messaging',
        description:
          'Posts to a channel when something needs your team. Never includes candidate names — it links back into Coral.',
        icon: 'MessageSquare',
        status: !this.slack.isConfigured() ? 'unavailable' : slackRow ? 'connected' : 'available',
        detail: !this.slack.isConfigured()
          ? 'Not enabled on this deployment yet.'
          : slackRow
            ? [slackRow.teamName, slackRow.channelName].filter(Boolean).join(' · ') || 'Connected'
            : null,
      },
      {
        key: 'microsoft',
        name: 'Outlook & Teams',
        category: 'Calendar',
        // One connection, not two: Microsoft Graph returns a Teams join URL
        // from the same call that creates the calendar event.
        description: 'Microsoft 365 calendar sync, with a Teams link on every confirmed interview.',
        icon: 'Mail',
        status: !this.microsoft.isConfigured()
          ? 'unavailable'
          : microsoftCredential
            ? 'connected'
            : 'available',
        detail: !this.microsoft.isConfigured()
          ? 'Not enabled on this deployment yet.'
          : microsoftCredential
            ? (microsoftCredential.microsoftEmail ?? 'Connected')
            : null,
      },
      {
        key: 'zoom',
        name: 'Zoom',
        category: 'Video',
        // Composes rather than replaces: Zoom supplies the link, a connected
        // calendar still creates the event that carries it.
        description:
          'Confirmed interviews get a Zoom link. Works alongside your calendar, which carries the link into the invite.',
        icon: 'Video',
        status: !this.zoom.isConfigured() ? 'unavailable' : zoomCredential ? 'connected' : 'available',
        detail: !this.zoom.isConfigured()
          ? 'Not enabled on this deployment yet.'
          : zoomCredential
            ? (zoomCredential.zoomEmail ?? 'Connected')
            : null,
      },
    ];
  }
}

