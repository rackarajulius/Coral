import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databasePoolOptions } from '../config/database.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Let the adapter own the pool so $disconnect() closes its connections.
    // An externally supplied Pool stays open unless explicitly opted into disposal.
    const adapter = new PrismaPg(databasePoolOptions());
    
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
