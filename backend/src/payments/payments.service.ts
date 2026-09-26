import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, WebhookProcessingStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { BillingWebhookService } from '../billing/billing-webhook.service';
import { SeekerBillingWebhookService } from '../seeker-billing/seeker-billing-webhook.service';
import { ListPaymentTransactionsQueryDto } from './dto/list-payment-transactions-query.dto';

interface StripeCheckoutSessionResponse {
  id?: string;
  url?: string;
  payment_intent?: string | null;
  expires_at?: number;
}

interface StripeEventEnvelope {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

@Injectable()
export class PaymentsService {
  private readonly defaultStripeApiUrl = 'https://api.stripe.com/v1';
  private readonly defaultWebhookToleranceSec = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly billingWebhooks: BillingWebhookService,
    private readonly seekerWebhooks: SeekerBillingWebhookService,
  ) {}

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const stripeSecretKey = this.getStripeSecretKey();
    const stripeApiUrl = this.getStripeApiUrl();

    const quantity = dto.quantity ?? 1;
    const unitAmount = dto.unitAmount;
    const currency = this.normalizeCurrency(dto.currency ?? 'usd');
    const productName = dto.productName.trim();
    const description = dto.description?.trim();
    const referenceType = dto.referenceType?.trim();
    const referenceId = dto.referenceId?.trim();
    const totalAmount = unitAmount * quantity;

    if (!productName) {
      throw new BadRequestException('productName is required');
    }

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        userId,
        amount: totalAmount,
        currency,
        description,
        referenceType,
        referenceId,
        metadata: {
          unitAmount,
          quantity,
          successUrl: dto.successUrl.trim(),
          cancelUrl: dto.cancelUrl.trim(),
          productName,
        },
      },
    });

    try {
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', dto.successUrl.trim());
      form.set('cancel_url', dto.cancelUrl.trim());
      form.set('client_reference_id', transaction.id);
      form.set('metadata[transactionId]', transaction.id);
      form.set('metadata[userId]', userId);
      if (referenceType) {
        form.set('metadata[referenceType]', referenceType);
      }
      if (referenceId) {
        form.set('metadata[referenceId]', referenceId);
      }
      form.set('payment_intent_data[metadata][transactionId]', transaction.id);
      form.set('payment_intent_data[metadata][userId]', userId);
      if (referenceType) {
        form.set('payment_intent_data[metadata][referenceType]', referenceType);
      }
      if (referenceId) {
        form.set('payment_intent_data[metadata][referenceId]', referenceId);
      }
      form.set('line_items[0][price_data][currency]', currency);
      form.set('line_items[0][price_data][unit_amount]', String(unitAmount));
      form.set('line_items[0][price_data][product_data][name]', productName);
      if (description) {
        form.set('line_items[0][price_data][product_data][description]', description);
      }
      form.set('line_items[0][quantity]', String(quantity));

      const response = await fetch(`${stripeApiUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadGatewayException(
          `Stripe checkout session request failed (${response.status}): ${errorText.slice(0, 300)}`,
        );
      }

      const session = (await response.json()) as StripeCheckoutSessionResponse;
      const checkoutSessionId = this.asString(session.id);
      const checkoutUrl = this.asString(session.url);
      const paymentIntentId = this.asString(session.payment_intent);

      if (!checkoutSessionId || !checkoutUrl) {
        throw new BadGatewayException('Stripe response did not contain checkout session details');
      }

      const updatedTransaction = await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          stripeCheckoutSessionId: checkoutSessionId,
          stripePaymentIntentId: paymentIntentId,
          status: PaymentStatus.REQUIRES_ACTION,
        },
      });

      return {
        transactionId: updatedTransaction.id,
        checkoutSessionId,
        checkoutUrl,
        amount: updatedTransaction.amount,
        currency: updatedTransaction.currency,
        status: updatedTransaction.status,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      };
    } catch (error) {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureMessage: this.toFailureMessage(error),
        },
      });
      throw error;
    }
  }

  async listMyTransactions(userId: string, query: ListPaymentTransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getMyTransaction(userId: string, transactionId: string) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    return transaction;
  }

  async handleStripeWebhook(rawBody: string, signatureHeader?: string) {
    if (!rawBody || rawBody.trim().length === 0) {
      throw new BadRequestException('Missing Stripe webhook payload');
    }

    const webhookSecret = this.getStripeWebhookSecret();
    this.verifyStripeSignature(rawBody, signatureHeader, webhookSecret);

    const event = this.parseStripeEvent(rawBody);
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: event.id },
    });

    if (existing && existing.processingStatus === WebhookProcessingStatus.PROCESSED) {
      return {
        received: true,
        duplicate: true,
        eventId: event.id,
        type: event.type,
      };
    }

    await this.prisma.paymentWebhookEvent.upsert({
      where: { providerEventId: event.id },
      create: {
        providerEventId: event.id,
        type: event.type,
        payload: event as Prisma.InputJsonValue,
        processingStatus: WebhookProcessingStatus.PENDING,
      },
      update: {
        type: event.type,
        payload: event as Prisma.InputJsonValue,
        processingStatus: WebhookProcessingStatus.PENDING,
        errorMessage: null,
      },
    });

    try {
      await this.processStripeEvent(event);
      await this.prisma.paymentWebhookEvent.update({
        where: { providerEventId: event.id },
        data: {
          processingStatus: WebhookProcessingStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { providerEventId: event.id },
        data: {
          processingStatus: WebhookProcessingStatus.FAILED,
          errorMessage: this.toFailureMessage(error),
        },
      });
      throw error;
    }

    return {
      received: true,
      duplicate: false,
      eventId: event.id,
      type: event.type,
    };
  }

  private async processStripeEvent(event: {
    id: string;
    type: string;
    object: Record<string, unknown>;
  }) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.markCheckoutSessionPaid(event.object);
        return;
      case 'checkout.session.async_payment_failed':
        await this.markCheckoutSessionFailed(event.object, PaymentStatus.FAILED);
        return;
      case 'checkout.session.expired':
        await this.markCheckoutSessionFailed(event.object, PaymentStatus.CANCELED);
        return;
      case 'payment_intent.succeeded':
        await this.markPaymentIntentPaid(event.object);
        return;
      case 'payment_intent.payment_failed':
        await this.markPaymentIntentFailed(event.object);
        return;
      case 'charge.refunded':
        await this.markRefunded(event.object);
        return;
      default:
        // Subscription and invoice events describe a plan rather than a
        // one-off charge. Two products subscribe through this one Stripe
        // account, so the job seeker handler is asked first — it claims only
        // its own tagged subscriptions and customers — and everything else is
        // a company's. The signature was verified above; only routing differs.
        if (await this.seekerWebhooks.claims(event.type, event.object)) {
          await this.seekerWebhooks.handle(event.type, event.object);
          return;
        }
        if (this.billingWebhooks.handles(event.type)) {
          await this.billingWebhooks.handle(event.type, event.object);
        }
        return;
    }
  }

  private async markCheckoutSessionPaid(session: Record<string, unknown>) {
    const checkoutSessionId = this.asString(session.id);
    const paymentIntentId = this.asString(session.payment_intent);
    const metadata = this.asRecord(session.metadata);
    const transactionIdFromMetadata = this.asString(metadata?.transactionId);
    const stripeCustomerId = this.asString(session.customer);

    const transaction = await this.resolveTransaction({
      transactionId: transactionIdFromMetadata,
      checkoutSessionId,
      paymentIntentId,
    });

    if (!transaction) {
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.PAID,
        stripeCheckoutSessionId: checkoutSessionId ?? transaction.stripeCheckoutSessionId,
        stripePaymentIntentId: paymentIntentId ?? transaction.stripePaymentIntentId,
        stripeCustomerId: stripeCustomerId ?? transaction.stripeCustomerId,
        paidAt: new Date(),
        failedAt: null,
        canceledAt: null,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  private async markCheckoutSessionFailed(
    session: Record<string, unknown>,
    status: 'FAILED' | 'CANCELED',
  ) {
    const checkoutSessionId = this.asString(session.id);
    const paymentIntentId = this.asString(session.payment_intent);
    const metadata = this.asRecord(session.metadata);
    const transactionIdFromMetadata = this.asString(metadata?.transactionId);

    const transaction = await this.resolveTransaction({
      transactionId: transactionIdFromMetadata,
      checkoutSessionId,
      paymentIntentId,
    });

    if (!transaction) {
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        stripeCheckoutSessionId: checkoutSessionId ?? transaction.stripeCheckoutSessionId,
        stripePaymentIntentId: paymentIntentId ?? transaction.stripePaymentIntentId,
        failedAt: status === PaymentStatus.FAILED ? new Date() : transaction.failedAt,
        canceledAt: status === PaymentStatus.CANCELED ? new Date() : transaction.canceledAt,
      },
    });
  }

  private async markPaymentIntentPaid(intent: Record<string, unknown>) {
    const paymentIntentId = this.asString(intent.id);
    const metadata = this.asRecord(intent.metadata);
    const transactionIdFromMetadata = this.asString(metadata?.transactionId);
    const stripeCustomerId = this.asString(intent.customer);

    const transaction = await this.resolveTransaction({
      transactionId: transactionIdFromMetadata,
      paymentIntentId,
    });

    if (!transaction) {
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.PAID,
        stripePaymentIntentId: paymentIntentId ?? transaction.stripePaymentIntentId,
        stripeCustomerId: stripeCustomerId ?? transaction.stripeCustomerId,
        paidAt: new Date(),
        failedAt: null,
        canceledAt: null,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  private async markPaymentIntentFailed(intent: Record<string, unknown>) {
    const paymentIntentId = this.asString(intent.id);
    const metadata = this.asRecord(intent.metadata);
    const transactionIdFromMetadata = this.asString(metadata?.transactionId);
    const lastPaymentError = this.asRecord(intent.last_payment_error);
    const failureCode = this.asString(lastPaymentError?.code);
    const failureMessage = this.asString(lastPaymentError?.message);

    const transaction = await this.resolveTransaction({
      transactionId: transactionIdFromMetadata,
      paymentIntentId,
    });

    if (!transaction) {
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.FAILED,
        stripePaymentIntentId: paymentIntentId ?? transaction.stripePaymentIntentId,
        failedAt: new Date(),
        failureCode,
        failureMessage,
      },
    });
  }

  private async markRefunded(charge: Record<string, unknown>) {
    const paymentIntentId = this.asString(charge.payment_intent);
    if (!paymentIntentId) {
      return;
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
      },
    });
  }

  private async resolveTransaction(input: {
    transactionId?: string | null;
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
  }) {
    if (input.transactionId) {
      const byId = await this.prisma.paymentTransaction.findUnique({
        where: { id: input.transactionId },
      });
      if (byId) {
        return byId;
      }
    }

    if (input.checkoutSessionId) {
      const bySessionId = await this.prisma.paymentTransaction.findUnique({
        where: { stripeCheckoutSessionId: input.checkoutSessionId },
      });
      if (bySessionId) {
        return bySessionId;
      }
    }

    if (input.paymentIntentId) {
      return this.prisma.paymentTransaction.findUnique({
        where: { stripePaymentIntentId: input.paymentIntentId },
      });
    }

    return null;
  }

  private parseStripeEvent(rawBody: string): {
    id: string;
    type: string;
    object: Record<string, unknown>;
  } {
    let parsed: StripeEventEnvelope;
    try {
      parsed = JSON.parse(rawBody) as StripeEventEnvelope;
    } catch {
      throw new BadRequestException('Stripe webhook payload is not valid JSON');
    }

    const eventId = this.asString(parsed.id);
    const type = this.asString(parsed.type);
    const object = this.asRecord(parsed.data?.object);

    if (!eventId || !type || !object) {
      throw new BadRequestException('Stripe webhook payload missing required fields');
    }

    return {
      id: eventId,
      type,
      object,
    };
  }

  private verifyStripeSignature(rawBody: string, signatureHeader: string | undefined, secret: string) {
    if (!signatureHeader) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    const signatureParts = signatureHeader.split(',');
    let timestamp: number | null = null;
    const v1Signatures: string[] = [];

    for (const part of signatureParts) {
      const [key, value] = part.split('=');
      if (!key || !value) {
        continue;
      }
      const normalizedKey = key.trim();
      const normalizedValue = value.trim();

      if (normalizedKey === 't') {
        const parsed = Number(normalizedValue);
        if (Number.isFinite(parsed)) {
          timestamp = parsed;
        }
      }

      if (normalizedKey === 'v1' && normalizedValue.length > 0) {
        v1Signatures.push(normalizedValue);
      }
    }

    if (!timestamp || v1Signatures.length === 0) {
      throw new BadRequestException('Invalid Stripe signature header format');
    }

    const toleranceSec = this.getWebhookToleranceSec();
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > toleranceSec) {
      throw new BadRequestException('Stripe webhook signature timestamp is outside tolerance');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const valid = v1Signatures.some((signature) =>
      this.safeCompareHexSignatures(signature, expectedSignature),
    );

    if (!valid) {
      throw new BadRequestException('Stripe webhook signature verification failed');
    }
  }

  private safeCompareHexSignatures(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return timingSafeEqual(left, right);
  }

  private getStripeSecretKey(): string {
    const value = this.configService.get<string>('STRIPE_SECRET_KEY', '').trim();
    if (!value) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env',
      );
    }
    return value;
  }

  private getStripeWebhookSecret(): string {
    const value = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '').trim();
    if (!value) {
      throw new ServiceUnavailableException(
        'Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET in backend/.env',
      );
    }
    return value;
  }

  private getStripeApiUrl(): string {
    return this.configService
      .get<string>('STRIPE_API_URL', this.defaultStripeApiUrl)
      .replace(/\/+$/, '');
  }

  private getWebhookToleranceSec(): number {
    const raw = this.configService.get<string>(
      'STRIPE_WEBHOOK_TOLERANCE_SEC',
      `${this.defaultWebhookToleranceSec}`,
    );
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultWebhookToleranceSec;
  }

  private normalizeCurrency(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(normalized)) {
      throw new BadRequestException('currency must be a valid 3-letter ISO code');
    }
    return normalized;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toFailureMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 500);
    }
    return 'Unexpected payment processing error';
  }
}
