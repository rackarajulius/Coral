import { registerAs } from '@nestjs/config';
import type { PoolConfig } from 'pg';

/** Prisma 7 uses the pg driver's pool settings, not connection_limit in the URL. */
export function databasePoolOptions(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const rawMax = env.DB_POOL_MAX?.trim();
  const max = rawMax ? Number(rawMax) : 5;
  if (!Number.isSafeInteger(max) || max < 1) {
    throw new Error('DB_POOL_MAX must be a positive integer.');
  }

  return {
    connectionString: env.DATABASE_URL,
    // Per process: leave room for other app instances and maintenance clients.
    max,
    connectionTimeoutMillis: 10_000,
    // Reuse expensive hosted TLS connections, but only within the bounded pool.
    idleTimeoutMillis: 60_000,
    keepAlive: true,
  };
}

export default registerAs('database', () => {
  const pool = databasePoolOptions();
  return {
    url: pool.connectionString || '',
    poolMin: Number(process.env.DB_POOL_MIN || 2),
    poolMax: pool.max,
    ssl: process.env.DB_SSL === 'true',
  };
});

