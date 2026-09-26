import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

interface CachedResponse {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CachedResponse>();
  private readonly ttlMs = 30_000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (req?.method !== 'GET') {
      return next.handle();
    }

    const key = req.originalUrl || req.url;
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return of(cached.value);
    }

    return next.handle().pipe(
      tap((value) => {
        this.cache.set(key, {
          value,
          expiresAt: now + this.ttlMs,
        });
      }),
    );
  }
}

