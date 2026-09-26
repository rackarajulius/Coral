import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../common/types/user.types';

/** Whether a user may use premium features. Admins always qualify. */
export function isPremiumUser(user?: User | null): boolean {
  if (!user) return false;
  return user.subscriptionTier === 'premium' || user.role === 'ADMIN';
}

/**
 * Premium gating is opt-in — off until billing is live. Flip on by setting
 * PREMIUM_ENFORCEMENT=true. While off, premium features are open to everyone.
 */
export function isPremiumEnforced(config: ConfigService): boolean {
  return config.get<string>('PREMIUM_ENFORCEMENT') === 'true';
}

/**
 * Restricts a route to premium members (or admins) — but only when enforcement
 * is enabled. Must run after JwtAuthGuard, which attaches the full DB user.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!isPremiumEnforced(this.config)) return true; // dev: open to all

    const user = context.switchToHttp().getRequest().user as User | undefined;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }
    if (!isPremiumUser(user)) {
      throw new ForbiddenException('This feature is available to premium members.');
    }
    return true;
  }
}
