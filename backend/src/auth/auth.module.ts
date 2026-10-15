import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountClosureService } from './account-closure.service';
import { ProviderAvatarService } from './provider-avatar.service';
import { StorageModule } from '../storage/storage.module';
import { StripeClient } from '../billing/stripe.client';
import { IntegrationsModule } from '../integrations/integrations.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [StorageModule, IntegrationsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountClosureService,
    ProviderAvatarService,
    StripeClient,
    // Register guards globally
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
