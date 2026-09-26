import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../common/types/user.types';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ListPaymentTransactionsQueryDto } from './dto/list-payment-transactions-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout-sessions')
  async createCheckoutSession(
    @CurrentUser() user: User,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const checkout = await this.paymentsService.createCheckoutSession(user.id, dto);
    return {
      success: true,
      message: 'Stripe checkout session created successfully',
      data: checkout,
    };
  }

  @Get('me/transactions')
  async listMyTransactions(
    @CurrentUser() user: User,
    @Query() query: ListPaymentTransactionsQueryDto,
  ) {
    const result = await this.paymentsService.listMyTransactions(user.id, query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('me/transactions/:id')
  async getMyTransaction(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ) {
    const transaction = await this.paymentsService.getMyTransaction(user.id, transactionId);
    return {
      success: true,
      data: transaction,
    };
  }

  @Public()
  @Post('webhooks/stripe')
  async handleStripeWebhook(
    @Req() request: { rawBody?: string | Buffer; body?: unknown },
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBody = this.extractRawBody(request);
    const result = await this.paymentsService.handleStripeWebhook(rawBody, signature);
    return {
      success: true,
      ...result,
    };
  }

  private extractRawBody(request: { rawBody?: string | Buffer; body?: unknown }): string {
    if (typeof request.rawBody === 'string') {
      return request.rawBody;
    }

    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody.toString('utf8');
    }

    if (typeof request.body === 'string') {
      return request.body;
    }

    if (Buffer.isBuffer(request.body)) {
      return request.body.toString('utf8');
    }

    return JSON.stringify(request.body ?? {});
  }
}
