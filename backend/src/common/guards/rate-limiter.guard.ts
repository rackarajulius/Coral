import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxRequests = 120;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(req);
    const path = req.path;
    const key = `${ip}:${path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (bucket.count >= this.maxRequests) {
      throw new HttpException(
        `Rate limit exceeded. Retry after ${Math.ceil((bucket.resetAt - now) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return true;
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }

    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }

    const ip = request.ip || request.socket.remoteAddress;
    if (!ip) {
      throw new BadRequestException('Unable to resolve client IP');
    }
    return ip;
  }
}
