import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleIntegrationController, GoogleCallbackController } from './google.controller';
import { WebhooksController } from './webhooks.controller';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsCatalogueService } from './integrations-catalogue.service';
import { WebhooksService } from './webhooks.service';
import { SlackService } from './slack.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { MicrosoftIntegrationController, MicrosoftCallbackController } from './microsoft.controller';
import { CalendarService } from './calendar.service';
import { ZoomService } from './zoom.service';
import { ZoomIntegrationController, ZoomCallbackController } from './zoom.controller';
import { SlackIntegrationController, SlackCallbackController } from './slack.controller';

@Module({
  controllers: [GoogleIntegrationController, GoogleCallbackController, WebhooksController, IntegrationsController, SlackIntegrationController, SlackCallbackController, MicrosoftIntegrationController, MicrosoftCallbackController, ZoomIntegrationController, ZoomCallbackController],
  providers: [GoogleCalendarService, WebhooksService, IntegrationsCatalogueService, SlackService, MicrosoftCalendarService, CalendarService, ZoomService],
  exports: [GoogleCalendarService, WebhooksService, SlackService, MicrosoftCalendarService, CalendarService, ZoomService],
})
export class IntegrationsModule {}
