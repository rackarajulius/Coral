import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyMemberStatus, UserRole } from '@prisma/client';
import { User } from '../common/types/user.types';
import { CompanyContextService } from './company-context.service';
import { Capability, ROLE_LABELS, roleHasCapability } from './capabilities';

export const CAPABILITY_KEY = 'company_capability';

/**
 * Restricts a route to seats holding every listed capability.
 *
 * Apply only to employer-facing routes. A route shared with job seekers must
 * not carry this — they hold no company seat and would be refused.
 */
export const RequiresCapability = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITY_KEY, capabilities);

/**
 * Enforces company roles.
 *
 * Runs after JwtAuthGuard, which attaches the database user.
 *
 * An employer with no membership is treated as an owner of their own one-person
 * company. That is not a loophole: company scoping resolves their visible
 * records to themselves alone, so full rights over their own data is exactly
 * right, and it keeps accounts created outside onboarding working.
 */
@Injectable()
export class CompanyCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyContext: CompanyContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Capability[]>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as User | undefined;
    if (!user) throw new ForbiddenException('User not authenticated');
    if (user.role === UserRole.ADMIN) return true;

    // Capabilities describe a company seat, so they only apply to someone
    // acting as an employer. Some routes are shared — sending a message is the
    // same endpoint for both sides — and a candidate who also holds a seat
    // somewhere must not be refused a reply to their own application.
    if (user.role !== UserRole.EMPLOYER) return true;

    const row = await this.companyContext.membershipFor(user.id);
    if (!row) return true; // never joined a company — see the class comment

    // Joined once and no longer active. This must be refused rather than
    // falling through to the sole-operator branch, which would let a suspended
    // recruiter carry on posting jobs under their own name.
    if (row.status !== CompanyMemberStatus.ACTIVE) {
      throw new ForbiddenException(
        row.status === CompanyMemberStatus.SUSPENDED
          ? 'Your access to this company is suspended.'
          : 'You are no longer a member of this company.',
      );
    }

    const missing = required.filter((c) => !roleHasCapability(row.role, c));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Your role (${ROLE_LABELS[row.role]}) does not allow this.`,
      );
    }
    return true;
  }
}
