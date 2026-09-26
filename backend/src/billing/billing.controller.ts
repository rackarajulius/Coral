import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { CreateCheckoutDto, CreatePortalDto } from './dto/billing.dto';

/**
 * Plan, usage, and the two doors into Stripe.
 *
 * The read routes are open to any member: a recruiter who cannot see they are
 * one job post from the cap will simply hit it without warning. The write
 * routes are `billing:manage`, which is OWNER-only — they reach payment
 * details and can change what the company is charged.
 */
@Controller('employers/billing')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly checkout: BillingCheckoutService,
  ) {}

  @Get('overview')
  async overview(@CurrentUser() user: User) {
    return { success: true, data: await this.billing.overview(user) };
  }

  /** Every plan and what it includes — the same registry enforcement reads. */
  @Get('entitlements')
  entitlements() {
    return { success: true, data: this.billing.entitlements() };
  }

  /**
   * Starts an upgrade. Returns a Stripe-hosted URL to follow.
   *
   * Nothing local changes here. The plan moves only when Stripe confirms it
   * over the webhook, so abandoning the checkout page grants nothing.
   */
  @RequiresCapability('billing:manage')
  @Post('checkout')
  async createCheckout(@CurrentUser() user: User, @Body() dto: CreateCheckoutDto) {
    return { success: true, data: await this.checkout.createCheckoutSession(user, dto) };
  }

  /**
   * Invoices, read live from Stripe.
   *
   * Owner-only like the other write routes even though it only reads: amounts
   * charged and tax details are payment data, and the capability line for that
   * is `billing:manage`.
   */
  @RequiresCapability('billing:manage')
  @Get('invoices')
  async invoices(@CurrentUser() user: User) {
    return { success: true, data: await this.checkout.listInvoices(user) };
  }

  /** A link into Stripe's portal, where cards, invoices and cancellation live. */
  @RequiresCapability('billing:manage')
  @Post('portal')
  async createPortal(@CurrentUser() user: User, @Body() dto: CreatePortalDto) {
    return { success: true, data: await this.checkout.createPortalSession(user, dto.returnUrl) };
  }
}
