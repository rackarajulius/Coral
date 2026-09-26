import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Create PostgreSQL connection pool
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      // Opening a connection to the hosted database is slow from far away (TLS
      // over a ~280 ms round trip: well over a second). node-postgres closes idle
      // connections after 10 s by default, so a page load after a short pause
      // reopened every one of them. Keep them for a minute instead; the number
      // of connections (max 10) is unchanged.
      idleTimeoutMillis: 60_000,
      keepAlive: true,
    });
    const adapter = new PrismaPg(pool);
    
    super({
      adapter,
      log: ['error', 'warn'], // Only log errors and warnings
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Database disconnected');
  }
}