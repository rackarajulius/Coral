import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import { json, raw, urlencoded, Request, Response } from 'express';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { AppValidationPipe } from '../common/pipes/validation.pipe';

export interface AppRuntimeConfig {
  apiPrefix: string;
  port: number;
}

export function configureApp(app: INestApplication): AppRuntimeConfig {
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const port = configService.get<number>('PORT', 3001);
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  const webhookPath = `/${apiPrefix}/payments/webhooks/stripe`;
  const captureRawBody = (request: Request & { rawBody?: string }, _response: Response, buffer: Buffer) => {
    if (buffer && buffer.length > 0) {
      request.rawBody = buffer.toString('utf8');
    }
  };

  // Stripe webhooks require the exact raw payload for signature verification.
  app.use(
    webhookPath,
    raw({
      type: 'application/json',
      verify: captureRawBody,
    }),
  );
  app.use(
    json({
      verify: captureRawBody,
      limit: '2mb',
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      verify: captureRawBody,
      limit: '2mb',
    }),
  );

  app.use(
    compression({
      filter: (req, res) => {
        // Compress responses with Content-Type matching /json|text/ or explicitly large responses
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // 1-9 (default 6 is good balance of speed/compression)
      threshold: 1024, // Only compress responses > 1KB
      memLevel: 8, // More memory = faster compression
    }),
  );

  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Handle favicon.ico requests gracefully
  app.use('/favicon.ico', (req: any, res: any) => {
    res.status(204).end(); // No Content - tells browser not to request favicon
  });

  return {
    apiPrefix,
    port,
  };
}
