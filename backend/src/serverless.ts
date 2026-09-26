import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

interface LambdaHttpEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
}

interface LambdaHttpResult {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

let appUrlPromise: Promise<string> | null = null;

async function bootstrapServer(): Promise<string> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  // Listen on a random port to avoid collisions across runtime environments.
  await app.listen(0, '127.0.0.1');
  return app.getUrl();
}

async function getAppUrl(): Promise<string> {
  if (!appUrlPromise) {
    appUrlPromise = bootstrapServer();
  }
  return appUrlPromise;
}

function toFetchHeaders(eventHeaders: Record<string, string | undefined> = {}): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(eventHeaders)) {
    if (!value) {
      continue;
    }

    if (key.toLowerCase() === 'host') {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function extractCookies(headers: Headers): string[] {
  const cookieHeaders: string[] = [];
  const headersWithGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };

  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    cookieHeaders.push(...headersWithGetSetCookie.getSetCookie());
  } else {
    const setCookie = headers.get('set-cookie');
    if (setCookie) {
      cookieHeaders.push(setCookie);
    }
  }

  return cookieHeaders;
}

function toLambdaHeaders(headers: Headers): Record<string, string> {
  const lambdaHeaders: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    lambdaHeaders[key] = value;
  });

  return lambdaHeaders;
}

export async function handler(event: LambdaHttpEvent): Promise<LambdaHttpResult> {
  const appUrl = await getAppUrl();

  const method = event.requestContext?.http?.method || 'GET';
  const path = event.rawPath || '/';
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `${appUrl}${path}${queryString}`;

  const body =
    event.body == null
      ? undefined
      : event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body;

  const response = await fetch(url, {
    method,
    headers: toFetchHeaders(event.headers),
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });

  const text = await response.text();
  const cookies = extractCookies(response.headers);

  return {
    statusCode: response.status,
    headers: toLambdaHeaders(response.headers),
    body: text,
    isBase64Encoded: false,
    ...(cookies.length > 0 ? { cookies } : {}),
  };
}
