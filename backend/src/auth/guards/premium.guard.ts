import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../common/types/user.types';

/** Whether a user may use premium features. Admins always qualify. */
export function isPremiumUser(user?: User | null): boolean {
  if (!user) return false;
  return user.subscriptionTier === 'premium' || user.role === 'ADMIN';
}

/**
 * Premium gating is opt-in — off until billing is live.
 *
 * `PREMIUM_ENFORCEMENT=true` gates every Premium feature at once. A list of
 * features gates just those, so they can go live one at a time:
 * `PREMIUM_ENFORCEMENT=matcher.web` makes web job matching Premium while
 * cover letters, tailoring, research and the coach stay open. Unset, all of
 * it is open to everyone.
 *
 * Without a `feature`, this asks whether everything is gated.
 */
export function isPremiumEnforced(config: ConfigService, feature?: string): boolean {
  const value = (config.get<string>('PREMIUM_ENFORCEMENT') ?? '').trim().toLowerCase();
  if (value === 'true') return true;
  if (!feature || !value) return false;
  return value
    .split(',')
    .map((f) => f.trim())
    .includes(feature.toLowerCase());
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
