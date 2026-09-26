import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

/** The longest comp an admin can grant in one go. */
const MAX_COMP_DAYS = 366;

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Who has Premium, and why — from both places it can come from.
 *
 * Premium is `stripeEntitled OR compedUntil > now`. The two are stored
 * separately and combined here, in one function, because every writer used to
 * set the tier flag directly: a webhook for a lapsed card would have ended an
 * admin's comp, and ending a comp would have ended someone's paid plan.
 *
 * Also sends the account emails for Premium: payment received, payment failed,
 * comp granted, comp ended. Email is best-effort throughout — a mail provider
 * outage must never undo or block the change it describes.
 */
@Injectable()
export class SeekerPremiumService {
  private readonly logger = new Logger(SeekerPremiumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Sets `User.subscriptionTier` from both sources. Pass a tx to join one. */
  async recomputeTier(userId: string, tx: Tx = this.prisma): Promise<'free' | 'premium'> {
    const row = await tx.userSubscription.findUnique({
      where: { userId },
      select: { stripeEntitled: true, compedUntil: true },
    });
    const comped = !!row?.compedUntil && row.compedUntil.getTime() > Date.now();
    const tier = row?.stripeEntitled || comped ? 'premium' : 'free';
    await tx.user.update({ where: { id: userId }, data: { subscriptionTier: tier } });
    return tier;
  }

  /* --------------------------------- comps -------------------------------- */

  /**
   * Gives someone Premium until a date, without payment.
   *
   * Replaces any existing comp rather than stacking — the date an admin picks
   * is the date it ends. A reason is required and kept, so every free month is
   * accounted for. The audit entry is written by the admin module, which owns
   * the audit trail.
   */
  async grantComp(adminId: string, userId: string, until: Date, reason: string) {
    const user = await this.jobSeeker(userId);

    const now = Date.now();
    if (!(until.getTime() > now)) {
      throw new BadRequestException('The end date has to be in the future.');
    }
    if (until.getTime() - now > MAX_COMP_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`A comp can last at most ${MAX_COMP_DAYS} days at a time.`);
    }
    const why = reason.trim();
    if (!why) throw new BadRequestException('Say why Premium is being given.');

    const before = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: { compedUntil: true },
    });

    const tier = await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.upsert({
        where: { userId },
        create: { userId, compedUntil: until, compReason: why, compedById: adminId },
        update: { compedUntil: until, compReason: why, compedById: adminId },
      });
      return this.recomputeTier(userId, tx);
    });

    await this.tell(user, {
      subject: 'You have Premium',
      heading: 'You have Premium',
      lines: [
        `You've been given Premium until ${this.date(until)} — no payment needed.`,
        'That includes more AI interview practice, jobs from across the web, cover letters and resume tailoring.',
      ],
      cta: { label: 'See what is included', path: '/premium' },
      notification: {
        title: 'You have Premium',
        message: `Premium is on for you until ${this.date(until)}.`,
      },
    });

    return { before: before?.compedUntil ?? null, after: until, tier };
  }

  /** Ends a comp now. A paid subscription, if there is one, is untouched. */
  async revokeComp(userId: string) {
    const user = await this.jobSeeker(userId);
    const before = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: { compedUntil: true },
    });
    if (!before?.compedUntil || before.compedUntil.getTime() <= Date.now()) {
      throw new BadRequestException('This person has no active comp.');
    }

    const tier = await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.update({
        where: { userId },
        // Ended now rather than cleared, so the record shows it existed.
        data: { compedUntil: new Date() },
      });
      return this.recomputeTier(userId, tx);
    });
    // The hourly sweep won't mention it — they're already free by then — so
    // the person hears it here. Nothing is said if a paid plan keeps them on.
    if (tier === 'free') await this.tellCompEnded(user);
    return { before: before.compedUntil, tier };
  }

  /** What an admin needs to see before granting or revoking. */
  async adminView(userId: string) {
    const user = await this.jobSeeker(userId);
    const row = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        status: true,
        stripeEntitled: true,
        interval: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        compedUntil: true,
        compReason: true,
        compedBy: { select: { displayName: true, email: true } },
      },
    });
    const compActive = !!row?.compedUntil && row.compedUntil.getTime() > Date.now();
    return {
      tier: user.subscriptionTier === 'premium' ? 'premium' : 'free',
      paid: {
        active: !!row?.stripeEntitled,
        status: row?.status ?? 'NONE',
        interval: row?.interval ?? null,
        currentPeriodEnd: row?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      },
      comp: {
        active: compActive,
        until: row?.compedUntil ?? null,
        reason: row?.compReason ?? null,
        grantedBy: row?.compedBy?.displayName || row?.compedBy?.email || null,
      },
    };
  }

  /**
   * Ends comps whose date has passed.
   *
   * The tier flag is stored, so nothing flips it on its own when a comp runs
   * out; this does, hourly, so a comp ends within the hour of its date. Only
   * people still marked Premium with no paid subscription behind it are
   * touched — a paid plan keeps them Premium.
   */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'premium-comp-expiry' })
  async expireComps(): Promise<number> {
    const expired = await this.prisma.userSubscription.findMany({
      where: {
        compedUntil: { lte: new Date() },
        stripeEntitled: false,
        user: { subscriptionTier: 'premium' },
      },
      select: { userId: true, user: { select: { id: true, email: true } } },
      take: 500,
    });

    let ended = 0;
    for (const row of expired) {
      try {
        const tier = await this.recomputeTier(row.userId);
        if (tier === 'free') {
          ended += 1;
          await this.tellCompEnded(row.user);
        }
      } catch (error) {
        this.logger.warn(
          `Could not end comp for ${row.userId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
    if (ended) this.logger.log(`Ended ${ended} expired Premium comp(s)`);
    return ended;
  }

  /* ------------------------------- payments -------------------------------- */

  /**
   * Tells someone a Premium payment went through.
   *
   * Links to Stripe's own hosted invoice rather than rendering a receipt of our
   * own — two documents for one charge is how disagreeing receipts end up in
   * someone's records. (Stripe can also email its receipt directly; if that is
   * switched on in the dashboard, this reads as a confirmation beside it.)
   */
  async paymentSucceeded(invoice: Record<string, unknown>) {
    const user = await this.userForCustomer(invoice.customer);
    if (!user) return;
    // A zero-amount invoice (a trial start, a full credit) isn't a payment.
    const amount = Number(invoice.amount_paid ?? 0);
    if (!(amount > 0)) return;

    const periodEnd = this.invoicePeriodEnd(invoice);
    const hosted = typeof invoice.hosted_invoice_url === 'string' ? invoice.hosted_invoice_url : null;
    await this.tell(user, {
      subject: 'Payment received — Premium is active',
      heading: 'Payment received',
      lines: [
        `We received ${this.money(amount, invoice.currency)} for Premium.`,
        periodEnd ? `Premium is active until ${this.date(periodEnd)}.` : 'Premium is active.',
      ],
      cta: hosted ? { label: 'View invoice', url: hosted } : { label: 'Manage billing', path: '/premium' },
    });
  }

  /** Tells someone a renewal failed — and that Premium stays on meanwhile. */
  async paymentFailed(invoice: Record<string, unknown>) {
    const user = await this.userForCustomer(invoice.customer);
    if (!user) return;
    const amount = Number(invoice.amount_due ?? 0);
    await this.tell(user, {
      subject: "We couldn't take your Premium payment",
      heading: "Your payment didn't go through",
      lines: [
        `We couldn't charge ${this.money(amount, invoice.currency)} for Premium.`,
        "Premium stays on while we try again over the next few days. Updating your card now keeps it from lapsing.",
      ],
      cta: { label: 'Update payment method', path: '/premium' },
      notification: {
        title: 'Premium payment failed',
        message: 'Update your card to keep Premium. It stays on while we retry.',
      },
    });
  }

  /* -------------------------------- helpers -------------------------------- */

  private tellCompEnded(user: { id: string; email: string }) {
    return this.tell(user, {
      subject: 'Your complimentary Premium has ended',
      heading: 'Your complimentary Premium has ended',
      lines: [
        'Your account is back on the free plan. Everything you made with Premium is still yours.',
        'You can keep going with Premium any time.',
      ],
      cta: { label: 'See Premium', path: '/premium' },
      notification: {
        title: 'Complimentary Premium ended',
        message: 'Your account is back on the free plan.',
      },
    });
  }

  private async jobSeeker(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, subscriptionTier: true },
    });
    if (!user || user.role !== 'JOB_SEEKER') throw new NotFoundException('Job seeker not found');
    return user;
  }

  private async userForCustomer(customer: unknown) {
    if (typeof customer !== 'string' || !customer) return null;
    const row = await this.prisma.userSubscription.findUnique({
      where: { stripeCustomerId: customer },
      select: { user: { select: { id: true, email: true } } },
    });
    return row?.user ?? null;
  }

  /**
   * One email and, optionally, one in-app notification. Never throws.
   *
   * Plain, short, and escaped: every line here is our own text, but the
   * escaping stays so a future caller can't turn a value into markup.
   */
  private async tell(
    user: { id: string; email: string },
    msg: {
      subject: string;
      heading: string;
      lines: string[];
      cta: { label: string; path?: string; url?: string };
      notification?: { title: string; message: string };
    },
  ) {
    const href = msg.cta.url ?? `${this.frontend()}${msg.cta.path ?? '/premium'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 520px;">
        <h2 style="margin: 0 0 12px 0;">${esc(msg.heading)}</h2>
        ${msg.lines.map((l) => `<p style="margin: 0 0 12px 0;">${esc(l)}</p>`).join('')}
        <p style="margin: 20px 0;"><a href="${esc(href)}" style="background:#f97362;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">${esc(msg.cta.label)}</a></p>
      </div>`.trim();
    const text = `${msg.heading}\n\n${msg.lines.join('\n\n')}\n\n${msg.cta.label}: ${href}`;

    try {
      await this.email.send({ to: user.email, subject: msg.subject, html, text });
    } catch (error) {
      this.logger.warn(
        `Premium email "${msg.subject}" to user ${user.id} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    if (msg.notification) {
      await this.notifications.create({
        userId: user.id,
        type: 'billing',
        title: msg.notification.title,
        message: msg.notification.message,
        link: msg.cta.path ?? '/premium',
      });
    }
  }

  private invoicePeriodEnd(invoice: Record<string, unknown>): Date | null {
    const lines = (invoice.lines as Record<string, unknown> | undefined)?.data as
      | Array<Record<string, unknown>>
      | undefined;
    const end = Number((lines?.[0]?.period as Record<string, unknown> | undefined)?.end);
    return Number.isFinite(end) && end > 0 ? new Date(end * 1000) : null;
  }

  private money(amount: number, currency: unknown): string {
    const code = (typeof currency === 'string' ? currency : 'cad').toUpperCase();
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: code }).format(amount / 100);
    } catch {
      return `${(amount / 100).toFixed(2)} ${code}`;
    }
  }

  private date(d: Date): string {
    return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  private frontend(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:8081').replace(/\/+$/, '');
  }
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
