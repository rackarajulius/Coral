import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingWebhookService } from './billing-webhook.service';
import { StripeClient } from './stripe.client';

/**
 * BillingService is exported for metering, which is called wherever an AI
 * operation completes. BillingWebhookService is exported for PaymentsService,
 * which owns Stripe signature verification and dispatches subscription events
 * here rather than keeping a second verifier.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingCheckoutService, BillingWebhookService, StripeClient],
  exports: [BillingService, BillingWebhookService],
})
export class BillingModule {}
