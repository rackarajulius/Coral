import { Module } from '@nestjs/common';
import { AtsController, CandidateOffersController } from './ats.controller';
import { CandidateNotesService } from './candidate-notes.service';
import { CandidateReactionsService } from './candidate-reactions.service';
import { OffersService } from './offers.service';
import { OfferSignalsService } from './offer-signals.service';
import { EmailTemplatesService } from './email-templates.service';
import { ScorecardsService } from './scorecards.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../services/email/email.module';

/**
 * The ATS primitives: candidate notes and tags, offers, and templated candidate
 * messaging. CompanyContextService and CompanyAuditService arrive via the
 * global CompanyModule.
 */
@Module({
  imports: [NotificationsModule, EmailModule],
  controllers: [AtsController, CandidateOffersController],
  providers: [
    CandidateNotesService,
    CandidateReactionsService,
    OffersService,
    OfferSignalsService,
    EmailTemplatesService,
    ScorecardsService,
  ],
  exports: [OffersService, CandidateReactionsService],
})
export class AtsModule {}
