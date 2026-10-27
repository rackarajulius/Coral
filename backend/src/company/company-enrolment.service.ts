import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';

export interface EnrolmentResult {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  /** ACTIVE when admitted outright, PENDING when it needs an owner's approval. */
  status: CompanyMemberStatus;
  /** Why approval is needed, when it is. Null when admitted. */
  pendingReason: string | null;
  /** True when they were already seated and nothing changed. */
  alreadyMember: boolean;
}

/**
 * Seating a person into a company.
 *
 * Shared by both routes in — a shared join link and an emailed invitation.
 * Whether someone is *entitled* to a seat differs between the two (a link
 * checks the email domain, an invitation checks the address it was sent to);
 * what happens once they are is identical, and duplicating it is how the two
 * paths would drift apart on exactly the details that matter.
 */
@Injectable()
export class CompanyEnrolmentService {
  constructor(private readonly prisma: PrismaService) {}

  async enrol(
    user: User,
    input: {
      companyId: string;
      companyName: string;
      role: CompanyRole;
      status: Extract<CompanyMemberStatus, 'ACTIVE' | 'PENDING'>;
      pendingReason: string | null;
      invitedById: string;
    },
  ): Promise<EnrolmentResult> {
    // One account, as on LinkedIn: a person joins their company from the
    // account they already have and keeps their own side of the product — the
    // seat is what lets them act for the company. Freelancers are not included
    // yet; that side has its own rules.
    const mayJoin =
      user.role === UserRole.EMPLOYER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.JOB_SEEKER;
    if (!mayJoin) {
      throw new ForbiddenException(
        "This account can't join a company yet. Sign in with an employer or job seeker account to join.",
      );
    }

    const existing = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: input.companyId, userId: user.id } },
    });

    if (existing?.status === CompanyMemberStatus.SUSPENDED) {
      throw new ForbiddenException('Your access to this company is suspended.');
    }

    // Nothing would change — they are already seated exactly like this. Callers
    // use `alreadyMember` to avoid charging a use, so re-opening a link (or
    // refreshing the page while waiting for approval) must land here rather
    // than re-running the upsert and consuming the invitation again.
    const unchanged =
      !!existing && existing.status === input.status && existing.role === input.role;
    if (existing?.status === CompanyMemberStatus.ACTIVE || unchanged) {
      return {
        companyId: input.companyId,
        companyName: input.companyName,
        role: existing!.role,
        status: existing!.status,
        pendingReason: existing!.status === CompanyMemberStatus.PENDING ? input.pendingReason : null,
        alreadyMember: true,
      };
    }

    // Belonging to two companies has no defined meaning here — company scope
    // resolves to a single membership — so refuse rather than silently picking.
    const elsewhere = await this.prisma.companyMember.findFirst({
      where: {
        userId: user.id,
        companyId: { not: input.companyId },
        status: CompanyMemberStatus.ACTIVE,
      },
      include: { company: { select: { name: true } } },
    });
    if (elsewhere) {
      throw new BadRequestException(
        `You're already part of ${elsewhere.company.name}. Leave that company before joining another.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.upsert({
        where: { companyId_userId: { companyId: input.companyId, userId: user.id } },
        create: {
          companyId: input.companyId,
          userId: user.id,
          role: input.role,
          status: input.status,
          invitedById: input.invitedById,
          joinedAt: input.status === CompanyMemberStatus.ACTIVE ? new Date() : null,
        },
        update: {
          role: input.role,
          status: input.status,
          joinedAt: input.status === CompanyMemberStatus.ACTIVE ? new Date() : null,
        },
      });

      // Only an admitted member's profile joins the company. A pending request
      // must leave the profile detached, or it would count toward a company
      // that has not accepted them.
      if (input.status === CompanyMemberStatus.ACTIVE) {
        await tx.employerProfile.updateMany({
          where: { userId: user.id },
          data: { companyId: input.companyId },
        });
      }

      // A brand-new account that hasn't chosen a side lands on the company side,
      // or it bounces off the employer gate into company setup and is asked to
      // create a second company — the thing it just avoided. An established
      // job seeker keeps their account as it is: the seat is what lets them act
      // for the company. Admins keep their role.
      if (user.role !== UserRole.ADMIN && user.status === UserStatus.PENDING_ONBOARDING) {
        await tx.user.update({
          where: { id: user.id },
          data: { status: UserStatus.ACTIVE, role: UserRole.EMPLOYER },
        });
      }
    });

    return {
      companyId: input.companyId,
      companyName: input.companyName,
      role: input.role,
      status: input.status,
      pendingReason: input.pendingReason,
      alreadyMember: false,
    };
  }
}
