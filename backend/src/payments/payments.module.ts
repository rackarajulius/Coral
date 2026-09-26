import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillingModule } from '../billing/billing.module';
import { SeekerBillingModule } from '../seeker-billing/seeker-billing.module';

/**
 * Imports BillingModule so subscription events can be dispatched to it. Stripe
 * signs every webhook the same way, so verification stays here and only the
 * handling is split by what the event is about.
 */
@Module({
  imports: [BillingModule, SeekerBillingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
