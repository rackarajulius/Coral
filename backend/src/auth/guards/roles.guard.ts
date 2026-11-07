import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyMemberStatus, UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { CompanyContextService } from '../../company/company-context.service';

/** Cached on the request: this guard runs twice (globally and per controller). */
const SEAT_KEY = Symbol('activeCompanySeat');

/**
 * One account, as on LinkedIn: what someone may do follows what they are, not
 * the account type they signed up with.
 *
 * - `JOB_SEEKER` on a route means "a person": job-seeker and employer accounts
 *   both have a personal side.
 * - `EMPLOYER` on a route means "acting for a company": an employer account,
 *   or anyone holding an ACTIVE seat on a company team.
 *
 * Seat details — suspended, removed, which capabilities — are
 * CompanyCapabilityGuard's job. Freelancers are deliberately unchanged for now.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly companyContext: CompanyContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (requiredRoles.includes(user.role)) return true;

    // The personal side of an employer account.
    if (requiredRoles.includes(UserRole.JOB_SEEKER) && user.role === UserRole.EMPLOYER) {
      return true;
    }

    // A job seeker acts for a company only through a seat they actually hold.
    // Never through having no company: that branch would hand every job
    // seeker an employer's powers over an empty one-person company.
    if (requiredRoles.includes(UserRole.EMPLOYER) && user.role === UserRole.JOB_SEEKER) {
      if (request[SEAT_KEY] === undefined) {
        const seat = await this.companyContext.membershipFor(user.id);
        request[SEAT_KEY] = seat?.status === CompanyMemberStatus.ACTIVE;
      }
      if (request[SEAT_KEY]) return true;
      throw new ForbiddenException('Create a company page or join your company to do this.');
    }

    throw new ForbiddenException(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`,
    );
  }
}
