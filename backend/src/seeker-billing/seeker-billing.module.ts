import { Body, Controller, Get, Module, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { StripeClient } from '../billing/stripe.client';
import { SeekerBillingService } from './seeker-billing.service';
import { SeekerBillingWebhookService } from './seeker-billing-webhook.service';
import { SeekerPremiumService } from './seeker-premium.service';
import { EmailModule } from '../services/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeekerCancelDto, SeekerCheckoutDto, SeekerPortalDto } from './dto/seeker-billing.dto';

/**
 * What Premium costs and includes. Public, and deliberately not under `/me`.
 *
 * It answers the same thing for everybody — Stripe's prices and the static tier
 * registry — and holds nothing about the caller, so requiring a session only
 * meant the page that explains Premium showed a sign-in error to anyone who
 * wasn't already a member. Stripe is read at most once per ten minutes behind
 * the service's own price cache, so being public costs no extra provider calls.
 */
@Controller('premium')
export class PremiumPlansController {
  constructor(private readonly billing: SeekerBillingService) {}

  @Public()
  @Get('plans')
  async plans() {
    return { success: true, data: await this.billing.plans() };
  }
}

/** A job seeker's own Premium subscription. Own data only; no ids in the path. */
@Controller('job-seekers/me/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class SeekerBillingController {
  constructor(private readonly billing: SeekerBillingService) {}

  @Get()
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.billing.subscription(user) };
  }

  /** Returns a Stripe-hosted URL. Premium starts only when Stripe confirms payment. */
  @Roles(UserRole.JOB_SEEKER)
  @Post('checkout')
  async checkout(@CurrentUser() user: User, @Body() dto: SeekerCheckoutDto) {
    return { success: true, data: await this.billing.checkout(user, dto.interval, dto.returnPath) };
  }

  @Roles(UserRole.JOB_SEEKER)
  @Post('portal')
  async portal(@CurrentUser() user: User, @Body() dto: SeekerPortalDto) {
    return { success: true, data: await this.billing.portal(user, dto.returnPath) };
  }

  /** Ends Premium when the paid period runs out. Returns the subscription as it now stands. */
  @Roles(UserRole.JOB_SEEKER)
  @Post('cancel')
  async cancel(@CurrentUser() user: User, @Body() dto: SeekerCancelDto) {
    return { success: true, data: await this.billing.cancel(user, dto) };
  }

  /**
   * Checks with Stripe directly, for the return from checkout — so Premium
   * switches on even when Stripe's webhook is late or never arrives.
   */
  @Roles(UserRole.JOB_SEEKER)
  @Post('sync')
  async sync(@CurrentUser() user: User) {
    return { success: true, data: await this.billing.sync(user) };
  }

  /** Undoes a cancellation before it takes effect. */
  @Roles(UserRole.JOB_SEEKER)
  @Post('keep')
  async keep(@CurrentUser() user: User) {
    return { success: true, data: await this.billing.keep(user) };
  }
}

/**
 * Exports the webhook handler for PaymentsService, which owns Stripe signature
 * verification and routes each event to whichever product it is about.
 */
@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [PremiumPlansController, SeekerBillingController],
  providers: [SeekerBillingService, SeekerBillingWebhookService, SeekerPremiumService, StripeClient],
  // SeekerPremiumService: the admin module grants and revokes comps through it.
  exports: [SeekerBillingWebhookService, SeekerPremiumService],
})
export class SeekerBillingModule {}
