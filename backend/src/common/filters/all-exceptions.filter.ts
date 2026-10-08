import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...this.actionableFields(exception),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * The few structured fields a refusal carries so the client can act on it —
   * `code`, and for allowance refusals which feature, which tier, and when it
   * comes back. Whitelisted: an exception's response object can hold anything,
   * and none of the rest belongs in a reply.
   */
  private actionableFields(exception: unknown): Record<string, unknown> {
    if (!(exception instanceof HttpException)) return {};
    const body = exception.getResponse();
    if (!body || typeof body !== 'object') return {};
    const b = body as Record<string, unknown>;
    if (b.code === 'ACCOUNT_CLOSED_CLEANUP_PENDING' && b.accountClosed === true) {
      return { code: b.code, accountClosed: true };
    }
    if (b.code !== 'PREMIUM_REQUIRED' && b.code !== 'ALLOWANCE_EXHAUSTED') return {};
    return { code: b.code, metric: b.metric, tier: b.tier, resetsAt: b.resetsAt ?? null };
  }
}

