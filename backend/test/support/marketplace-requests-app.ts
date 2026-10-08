import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../src/auth/auth.service';
import { configureApp } from '../../src/bootstrap/configure-app';
import { MarketplaceController, ServicesController } from '../../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../../src/marketplace/marketplace.service';
import { MarketplaceRequestsController } from '../../src/marketplace/marketplace-requests.controller';
import { MarketplaceRequestsService } from '../../src/marketplace/marketplace-requests.service';
import { MarketplaceActivityService } from '../../src/marketplace/marketplace-activity.service';
import { MarketplaceActivityController } from '../../src/marketplace/marketplace-activity.controller';
import { GigsController } from '../../src/gigs/gigs.controller';
import { GigsService } from '../../src/gigs/gigs.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SupabaseService } from '../../src/supabase/supabase.service';

/** Real HTTP, production guards/validation and database; external identity verification only is replaced. */
export async function createMarketplaceRequestsApp(prisma: PrismaClient) {
  @Module({
    controllers: [MarketplaceController, ServicesController, GigsController, MarketplaceRequestsController, MarketplaceActivityController],
    providers: [MarketplaceService, GigsService, MarketplaceRequestsService, MarketplaceActivityService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: new ConfigService({ API_PREFIX: 'api/v1' }) },
      { provide: SupabaseService, useValue: { verifyTokenCached: async (token: string) => {
        const user = await prisma.user.findUnique({ where: { id: token } }); return user ? { id: user.supabaseId } : null;
      } } },
      { provide: AuthService, useValue: { findOrCreateUser: ({ id }: { id: string }) => prisma.user.findUniqueOrThrow({ where: { supabaseId: id } }) } },
    ],
  }) class MarketplaceRequestsTestModule {}
  const app = await NestFactory.create(MarketplaceRequestsTestModule, { logger: false, abortOnError: false });
  configureApp(app); await app.listen(0, '127.0.0.1');
  return { app, baseUrl: `${await app.getUrl()}/api/v1` };
}
