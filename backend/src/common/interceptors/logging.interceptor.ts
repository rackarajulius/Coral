import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const method = req?.method || 'UNKNOWN';
    const url = req?.url || 'UNKNOWN';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`${method} ${url} ${duration}ms`);
      }),
    );
  }
}

