import { Body, Controller, Get, Module, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { StripeClient } from '../billing/stripe.client';
import { SeekerBillingService } from './seeker-billing.service';
import { SeekerBillingWebhookService } from './seeker-billing-webhook.service';
import { SeekerPremiumService } from './seeker-premium.service';
import { EmailModule } from '../services/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeekerCheckoutDto, SeekerPortalDto } from './dto/seeker-billing.dto';

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

  /** Real prices from Stripe plus the tier table the server meters against. */
  @Get('plans')
  async plans() {
    return { success: true, data: await this.billing.plans() };
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
}

/**
 * Exports the webhook handler for PaymentsService, which owns Stripe signature
 * verification and routes each event to whichever product it is about.
 */
@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [SeekerBillingController],
  providers: [SeekerBillingService, SeekerBillingWebhookService, SeekerPremiumService, StripeClient],
  // SeekerPremiumService: the admin module grants and revokes comps through it.
  exports: [SeekerBillingWebhookService, SeekerPremiumService],
})
export class SeekerBillingModule {}
