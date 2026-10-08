import { BillingController } from '../../src/billing/billing.controller';
import { BillingCheckoutService } from '../../src/billing/billing-checkout.service';
import { BillingWebhookService } from '../../src/billing/billing-webhook.service';
import { PlanPricingService } from '../../src/billing/plan-pricing.service';
import { StripeClient } from '../../src/billing/stripe.client';
import { PaymentsController } from '../../src/payments/payments.controller';
import { PaymentsService } from '../../src/payments/payments.service';
import { SeekerBillingWebhookService } from '../../src/seeker-billing/seeker-billing-webhook.service';
import { IntegrityService } from '../../src/employer-hiring/integrity.service';
import { WebhooksService } from '../../src/integrations/webhooks.service';
import { JobsController } from '../../src/jobs/jobs.controller';
import { FreelancersController } from '../../src/freelancers/freelancers.controller';
import { FreelancersService } from '../../src/freelancers/freelancers.service';
import { JobsService } from '../../src/jobs/jobs.service';
import { JobMatchService } from '../../src/jobs/job-match.service';
import { JobFitService } from '../../src/jobs/job-fit.service';
import { MatchScoreService } from '../../src/applications/match-score.service';
import { CompanyResearchService } from '../../src/resume-matcher/company-research/company-research.service';
import { AnalyticsEventsService } from '../../src/analytics/analytics-events.service';
import { EmployerVerificationService } from '../../src/employers/employer-verification.service';
import { InterviewService } from '../../src/employer-hiring/interview.service';
import { AvailabilityService } from '../../src/employer-hiring/availability.service';
import { CalendarService } from '../../src/integrations/calendar.service';
import { GoogleCalendarService } from '../../src/integrations/google-calendar.service';
import { MicrosoftCalendarService } from '../../src/integrations/microsoft-calendar.service';
import { ZoomService } from '../../src/integrations/zoom.service';
import { CandidateSourcingService } from '../../src/employer-hiring/candidate-sourcing.service';
import { OutreachService } from '../../src/employer-hiring/outreach.service';
import { AiScreenService } from '../../src/employer-hiring/ai-screen.service';
import { CopilotService } from '../../src/employer-hiring/copilot.service';
import { AiService } from '../../src/services/ai/ai.service';
import { ShortlistService } from '../../src/employer-hiring/shortlist.service';
import { BillingService } from '../../src/billing/billing.service';
import { ProfileImpressionsService } from '../../src/job-seekers/profile-impressions.service';
import { CandidateScreensController, HiringController, CandidateInterviewsController, InterviewRoomController, AvailabilityController, BookingController } from '../../src/employer-hiring/hiring.controller';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { ApplicationsController } from '../../src/applications/applications.controller';
import { ApplicationsService } from '../../src/applications/applications.service';
import { ExternalApplicationsService } from '../../src/applications/external-applications.service';
import { PipelineService } from '../../src/applications/pipeline.service';
import { AtsController, CandidateOffersController } from '../../src/ats/ats.controller';
import { CandidateNotesService } from '../../src/ats/candidate-notes.service';
import { CandidateReactionsService } from '../../src/ats/candidate-reactions.service';
import { EmailTemplatesService } from '../../src/ats/email-templates.service';
import { OffersService } from '../../src/ats/offers.service';
import { OfferSignalsService } from '../../src/ats/offer-signals.service';
import { ScorecardsService } from '../../src/ats/scorecards.service';
import { AuthService } from '../../src/auth/auth.service';
import { configureApp } from '../../src/bootstrap/configure-app';
import { CompanyAuditService } from '../../src/company/company-audit.service';
import { CompanyContextService } from '../../src/company/company-context.service';
import { CandidateWatchersService } from '../../src/company/candidate-watchers.service';
import { PipelineLinkService } from '../../src/company/pipeline-link.service';
import { SlackService } from '../../src/integrations/slack.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailService } from '../../src/services/email/email.service';
import { StorageService } from '../../src/storage/storage.service';
import { SupabaseService } from '../../src/supabase/supabase.service';

/** Real HTTP, guards, validation, services and persistence; no external delivery. */
export async function createHiringApp(prisma: PrismaClient) {
  const ai = new AiService(new ConfigService());
  const aiComplete = jest.spyOn(ai as unknown as { complete: (...args: unknown[]) => Promise<unknown> }, 'complete')
    .mockRejectedValue(new Error('No AI response configured for this test'));
  const delivery = {
    aiComplete,
    stripePost: jest.fn().mockRejectedValue(new Error('Unexpected Stripe POST')),
    stripeGet: jest.fn().mockRejectedValue(new Error('Unexpected Stripe GET')),
    webhook: jest.fn().mockResolvedValue(undefined),
    email: jest.fn().mockResolvedValue(undefined),
    googleCreate: jest.fn().mockImplementation(async () => ({ eventId: 'google-event', meetLink: 'https://meet.example.test/interview' })),
    microsoftCreate: jest.fn().mockImplementation(async () => ({ eventId: 'microsoft-event', meetLink: 'https://teams.example.test/interview' })),
    googleDelete: jest.fn().mockResolvedValue(undefined),
    microsoftDelete: jest.fn().mockResolvedValue(undefined),
    zoomCreate: jest.fn().mockResolvedValue(null),
    zoomDelete: jest.fn().mockResolvedValue(undefined),
  };
  @Module({
    controllers: [BillingController, PaymentsController, ApplicationsController, AtsController, CandidateOffersController, JobsController, FreelancersController, CandidateScreensController, HiringController, CandidateInterviewsController, InterviewRoomController, AvailabilityController, BookingController],
    providers: [
      BillingService, BillingCheckoutService, BillingWebhookService, PlanPricingService, PaymentsService,
      { provide: StripeClient, useValue: { configured: true, post: delivery.stripePost, get: delivery.stripeGet } },
      { provide: SeekerBillingWebhookService, useValue: { claims: async () => false } },
      JobsService, FreelancersService, MatchScoreService, EmployerVerificationService, InterviewService, AvailabilityService, CalendarService, AiScreenService, IntegrityService,
      ...[JobMatchService, JobFitService, CompanyResearchService, CandidateSourcingService,
        OutreachService, CopilotService, ShortlistService,
        ProfileImpressionsService].map((provide) => ({ provide, useValue: {} })),
      { provide: AiService, useValue: ai },
      { provide: WebhooksService, useValue: { emit: delivery.webhook } },
      { provide: AnalyticsEventsService, useValue: { record: async () => undefined } },
      { provide: GoogleCalendarService, useValue: { createMeetEvent: delivery.googleCreate, deleteEvent: delivery.googleDelete } },
      { provide: MicrosoftCalendarService, useValue: { createTeamsEvent: delivery.microsoftCreate, deleteEvent: delivery.microsoftDelete } },
      { provide: ZoomService, useValue: { createMeeting: delivery.zoomCreate, deleteMeeting: delivery.zoomDelete } },
      ApplicationsService, ExternalApplicationsService, PipelineService, OffersService, OfferSignalsService,
      CandidateReactionsService, CompanyContextService, CompanyAuditService,
      CandidateWatchersService, PipelineLinkService, NotificationsService, ScorecardsService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: new ConfigService({ API_PREFIX: 'api/v1', STRIPE_WEBHOOK_SECRET: 'whsec_fixture_only', STRIPE_PRICE_PRO_MONTHLY: 'price_pro_month', STRIPE_PRICE_PRO_YEARLY: 'price_pro_year' }) },
      // Identity verification is the external boundary; the real JWT/role/seat guards run.
      { provide: SupabaseService, useValue: {
        verifyTokenCached: async (token: string) => {
          const user = await prisma.user.findUnique({ where: { id: token } });
          return user ? { id: user.supabaseId } : null;
        },
      } },
      { provide: AuthService, useValue: {
        findOrCreateUser: ({ id }: { id: string }) => prisma.user.findUniqueOrThrow({ where: { supabaseId: id } }),
      } },
      { provide: SlackService, useValue: { notify: async () => undefined } },
      { provide: EmailService, useValue: { sendPlainText: delivery.email } },
      { provide: StorageService, useValue: {} },
      // These unrelated ATS routes are outside this suite's scope.
      { provide: CandidateNotesService, useValue: {} },
      { provide: EmailTemplatesService, useValue: {} },
    ],
  })
  class HiringTestModule {}

  const app = await NestFactory.create(HiringTestModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const baseUrl = `${await app.getUrl()}/api/v1`;
  return { app, baseUrl, delivery };
}
