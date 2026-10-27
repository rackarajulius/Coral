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
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CompanyContextService } from './company-context.service';
import { Capability, ROLE_LABELS, roleHasCapability } from './capabilities';

export const CAPABILITY_KEY = 'company_capability';

/**
 * Restricts a route to seats holding every listed capability.
 *
 * Enforced on employer-facing routes. On a route shared with job seekers it
 * records intent only: the guard cannot tell which side the caller is acting
 * for, so the service must check the seat itself when it is the company side.
 */
export const RequiresCapability = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITY_KEY, capabilities);

/**
 * Enforces company roles.
 *
 * Runs after JwtAuthGuard, which attaches the database user.
 *
 * An employer *account* with no membership is treated as an owner of its own
 * one-person company. That is not a loophole: company scoping resolves their
 * visible records to themselves alone, so full rights over their own data is
 * exactly right, and it keeps accounts created before teams existed working.
 * It is never extended to anyone else — a job seeker acts for a company only
 * through a seat.
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

    // Capabilities describe a company seat. On a route both sides use —
    // sending a message is one endpoint — the same person may be writing as a
    // candidate (to a company they applied to) or for their own company, and
    // only the conversation says which. Those routes check in the service.
    const routeRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (routeRoles?.includes(UserRole.JOB_SEEKER)) return true;

    const row = await this.companyContext.membershipFor(user.id);
    if (!row) {
      if (user.role === UserRole.EMPLOYER) return true; // see the class comment
      throw new ForbiddenException('Create a company page or join your company to do this.');
    }

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
