import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../src/auth/auth.service';
import { configureApp } from '../../src/bootstrap/configure-app';
import { FreelancersController } from '../../src/freelancers/freelancers.controller';
import { FreelancersService } from '../../src/freelancers/freelancers.service';
import { GigsController } from '../../src/gigs/gigs.controller';
import { GigsService } from '../../src/gigs/gigs.service';
import { MarketplaceController, ServicesController } from '../../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../../src/marketplace/marketplace.service';
import { MarketplaceModerationController } from '../../src/marketplace/marketplace-moderation.controller';
import { MarketplaceModerationService } from '../../src/marketplace/marketplace-moderation.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SupabaseService } from '../../src/supabase/supabase.service';

/** Real HTTP/validation/guards/database; only external identity verification is replaced. */
export async function createMarketplaceApp(prisma: PrismaClient) {
  @Module({
    controllers: [MarketplaceController, ServicesController, MarketplaceModerationController, GigsController, FreelancersController],
    providers: [MarketplaceService, MarketplaceModerationService, GigsService, FreelancersService,
      { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: new ConfigService({ API_PREFIX: 'api/v1' }) },
      { provide: SupabaseService, useValue: { verifyTokenCached: async (token: string) => {
        const user = await prisma.user.findUnique({ where: { id: token } }); return user ? { id: user.supabaseId } : null;
      } } },
      { provide: AuthService, useValue: { findOrCreateUser: ({ id }: { id: string }) => prisma.user.findUniqueOrThrow({ where: { supabaseId: id } }) } },
    ],
  }) class MarketplaceTestModule {}
  const app = await NestFactory.create(MarketplaceTestModule, { logger: false, abortOnError: false });
  configureApp(app); await app.listen(0, '127.0.0.1');
  return { app, baseUrl: `${await app.getUrl()}/api/v1` };
}
