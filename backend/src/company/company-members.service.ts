import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import {
  CompanyInvitationStatus,
  CompanyMemberStatus,
  CompanyRole,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email/email.service';
import { User } from '../common/types/user.types';
import { CompanyContextService } from './company-context.service';
import { CompanyAuditService, displayName } from './company-audit.service';
import { CompanyEnrolmentService } from './company-enrolment.service';
import {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_LIMITATIONS,
} from './capabilities';

const INVITE_TTL_DAYS = 7;

/**
 * Team management for a company.
 *
 * Every mutation here runs through the same two questions: may the caller
 * manage members at all, and does the change leave the company still
 * administrable. The second matters more than it looks — a company with no
 * active owner cannot invite, cannot change roles and cannot recover itself.
 */
@Injectable()
export class CompanyMembersService {
  private readonly logger = new Logger(CompanyMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly enrolment: CompanyEnrolmentService,
    private readonly audit: CompanyAuditService,
  ) {}

  /** The role reference shown in the UI. Generated from the enforced map. */
  roles() {
    return Object.values(CompanyRole).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      capabilities: ROLE_CAPABILITIES[role],
      // Stated rather than hidden: a role page that implies a restriction we
      // do not enforce is worse than no role page.
      limitation: ROLE_LIMITATIONS[role] ?? null,
    }));
  }

  /**
   * What this caller may do, for the UI to decide what to offer.
   *
   * Mirrors the guard exactly, including the case it treats as a sole operator:
   * an employer who never joined a company holds every capability over their
   * own records. Answering anything narrower here would hide controls from
   * someone the server would have allowed.
   */
  async mySeat(user: User) {
    if (user.role === UserRole.ADMIN) {
      return { role: null, status: null, capabilities: [...CAPABILITIES] };
    }

    const membership = await this.companyContext.membershipFor(user.id);
    if (!membership) {
      return { role: CompanyRole.OWNER, status: CompanyMemberStatus.ACTIVE, capabilities: [...CAPABILITIES] };
    }
    if (membership.status !== CompanyMemberStatus.ACTIVE) {
      // Suspended or removed: the guard refuses everything, so offer nothing.
      return { role: membership.role, status: membership.status, capabilities: [] };
    }
    return {
      role: membership.role,
      status: membership.status,
      capabilities: ROLE_CAPABILITIES[membership.role],
    };
  }

  async list(user: User) {
    const context = await this.companyContext.requireForUser(user.id);

    const [members, invitations] = await Promise.all([
      this.prisma.companyMember.findMany({
        where: { companyId: context.companyId, status: { not: CompanyMemberStatus.REMOVED } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              lastLoginAt: true,
            },
          },
        },
      }),
      this.prisma.companyInvitation.findMany({
        where: { companyId: context.companyId, status: CompanyInvitationStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);

    return {
      companyId: context.companyId,
      companyName: context.companyName,
      myRole: context.role,
      canManage: CompanyContextService.canManageMembers(context.role),
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name:
          m.user.displayName?.trim() ||
          [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim() ||
          m.user.email,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        lastActiveAt: m.user.lastLoginAt,
        isSelf: m.userId === user.id,
      })),
      // Expiry is shown rather than filtered, so an invitation that quietly
      // aged out is visible as such instead of vanishing.
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        expired: i.expiresAt.getTime() < Date.now(),
        createdAt: i.createdAt,
      })),
    };
  }

  async invite(user: User, dto: { email: string; role: CompanyRole }) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    this.assertMayAssignRole(context.role, dto.role);

    const email = dto.email.trim().toLowerCase();
    if (!email.includes('@')) throw new BadRequestException('Enter a valid email address.');

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      const member = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: context.companyId, userId: existing.id } },
        select: { status: true },
      });
      if (member && member.status !== CompanyMemberStatus.REMOVED) {
        throw new BadRequestException(
          member.status === CompanyMemberStatus.PENDING
            ? 'That person has already asked to join — approve their request instead.'
            : 'That person is already on your team.',
        );
      }
    }

    // The raw token goes in the email and is never stored: the link admits its
    // holder to other people's applications and CVs.
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Supersede any live invitation to this address — a partial unique index
    // allows exactly one PENDING row per address per company.
    await this.prisma.companyInvitation.updateMany({
      where: {
        companyId: context.companyId,
        email,
        status: CompanyInvitationStatus.PENDING,
      },
      data: { status: CompanyInvitationStatus.REVOKED },
    });

    const invitation = await this.prisma.companyInvitation.create({
      data: {
        companyId: context.companyId,
        email,
        role: dto.role,
        tokenHash,
        invitedById: user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });

    await this.sendInviteEmail(email, token, context.companyName, dto.role);
    void this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name: displayName(user) },
      category: 'TEAM',
      action: 'Invited a member',
      entityType: 'Invitation',
      entityId: invitation.id,
      entityName: email,
      summary: `Invited ${email} as ${ROLE_LABELS[dto.role]}`,
    });
    return { ...invitation, expired: false };
  }

  async revokeInvitation(user: User, invitationId: string) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const { count } = await this.prisma.companyInvitation.updateMany({
      where: {
        id: invitationId,
        companyId: context.companyId,
        status: CompanyInvitationStatus.PENDING,
      },
      data: { status: CompanyInvitationStatus.REVOKED },
    });
    if (count === 0) throw new NotFoundException('Invitation not found');
    return { revoked: true };
  }

  /** Admits someone who asked to join on a matching email domain. */
  async approve(user: User, memberId: string, role?: CompanyRole) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const member = await this.requireMember(context.companyId, memberId);
    if (member.status !== CompanyMemberStatus.PENDING) {
      throw new BadRequestException('That request has already been dealt with.');
    }
    this.assertMayAssignRole(context.role, role ?? member.role);

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: {
        status: CompanyMemberStatus.ACTIVE,
        role: role ?? member.role,
        joinedAt: new Date(),
        invitedById: user.id,
      },
    });

    // Only now does their profile belong to the company — onboarding leaves it
    // detached precisely so a pending request grants nothing.
    await this.prisma.employerProfile
      .updateMany({ where: { userId: member.userId }, data: { companyId: context.companyId } })
      .catch(() => undefined);

    void this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name: displayName(user) },
      category: 'TEAM',
      action: 'Approved a join request',
      entityType: 'Member',
      entityId: member.userId,
      summary: `Approved a request to join as ${ROLE_LABELS[updated.role]}`,
    });
    return updated;
  }

  async setRole(user: User, memberId: string, role: CompanyRole) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const member = await this.requireMember(context.companyId, memberId);

    if (member.userId === user.id) {
      throw new ForbiddenException('You cannot change your own role.');
    }
    this.assertMayManageTarget(context.role, member.role);
    this.assertMayAssignRole(context.role, role);
    if (member.role === CompanyRole.OWNER) {
      await this.assertNotLastOwner(context.companyId, member.id);
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { role },
    });
    void this.audit.record({
      companyId: context.companyId,
      actor: { id: user.id, name: displayName(user) },
      category: 'TEAM',
      action: 'Changed a role',
      entityType: 'Member',
      entityId: member.userId,
      summary: `Changed a member's role from ${ROLE_LABELS[member.role]} to ${ROLE_LABELS[role]}`,
      before: { role: member.role },
      after: { role },
    });
    return updated;
  }

  async setStatus(
    user: User,
    memberId: string,
    status: Extract<CompanyMemberStatus, 'ACTIVE' | 'SUSPENDED' | 'REMOVED'>,
  ) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const member = await this.requireMember(context.companyId, memberId);

    if (member.userId === user.id) {
      throw new ForbiddenException('You cannot suspend or remove your own account.');
    }
    this.assertMayManageTarget(context.role, member.role);
    if (status !== CompanyMemberStatus.ACTIVE && member.role === CompanyRole.OWNER) {
      await this.assertNotLastOwner(context.companyId, member.id);
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { status },
    });

    // Detach their profile so the company page no longer counts them, while the
    // membership row stays REMOVED so the company keeps their work.
    if (status === CompanyMemberStatus.REMOVED) {
      await this.prisma.employerProfile
        .updateMany({ where: { userId: member.userId }, data: { companyId: null } })
        .catch(() => undefined);
    }

    return updated;
  }

  /* --------------------------- accepting an invite ------------------------ */

  /**
   * What an invitation is for, shown before anyone signs in.
   *
   * Includes the address it was sent to, because the single most common
   * failure is being signed in as the wrong account — telling someone that up
   * front is far kinder than refusing them after they commit.
   */
  async previewInvitation(token: string) {
    const invitation = await this.findUsableInvitation(token);
    const company = await this.prisma.company.findUnique({
      where: { id: invitation.companyId },
      select: { name: true },
    });
    return {
      companyName: company?.name ?? 'this company',
      role: invitation.role,
      email: invitation.email,
    };
  }

  async acceptInvitation(user: User, token: string) {
    const invitation = await this.findUsableInvitation(token);

    // The invitation is addressed to one person. Without this check, forwarding
    // the email hands the recipient a working key to this company's
    // applications and CVs — which is exactly what the domain lock protects the
    // shareable link from, and an addressed invitation has no domain to fall
    // back on.
    if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new ForbiddenException(
        `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`,
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: invitation.companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('That company no longer exists.');

    // An unconfirmed address proves nothing — anyone can type someone else's
    // email at signup. Rather than refuse, fall back to the approval queue the
    // company already watches.
    const verified = user.emailVerified;
    const result = await this.enrolment.enrol(user, {
      companyId: company.id,
      companyName: company.name,
      role: invitation.role,
      status: verified ? CompanyMemberStatus.ACTIVE : CompanyMemberStatus.PENDING,
      pendingReason: verified
        ? null
        : 'Confirm your email address, or ask an owner to approve you.',
      invitedById: invitation.invitedById,
    });

    if (!result.alreadyMember) {
      await this.prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: CompanyInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: user.id,
        },
      });
    }

    return result;
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * Resolves a raw invitation token.
   *
   * The stored value is a SHA-256 digest, so the raw token never has to exist
   * in the database for this to work. Every failure returns one message: a
   * probe must not learn whether a token existed, only that it does not work.
   */
  private async findUsableInvitation(token: string) {
    const dead = new NotFoundException('That invitation has expired or is no longer valid.');
    if (!token?.trim()) throw dead;

    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const invitation = await this.prisma.companyInvitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.status !== CompanyInvitationStatus.PENDING) throw dead;
    if (invitation.expiresAt.getTime() < Date.now()) throw dead;
    return invitation;
  }

  private async requireMember(companyId: string, memberId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });
    if (!member) throw new NotFoundException('Team member not found');
    return member;
  }

  /** Only an owner may create or manage another owner. */
  private assertMayAssignRole(actorRole: CompanyRole, target: CompanyRole) {
    if (target === CompanyRole.OWNER && actorRole !== CompanyRole.OWNER) {
      throw new ForbiddenException('Only an owner can make someone else an owner.');
    }
  }

  private assertMayManageTarget(actorRole: CompanyRole, targetRole: CompanyRole) {
    if (targetRole === CompanyRole.OWNER && actorRole !== CompanyRole.OWNER) {
      throw new ForbiddenException('Only an owner can manage another owner.');
    }
  }

  /**
   * A company must always keep one active owner.
   *
   * Without this the last owner can be demoted or removed, and the company is
   * left with nobody who can invite, change roles or undo it — a state no
   * amount of UI can recover from.
   */
  private async assertNotLastOwner(companyId: string, excludingMemberId: string) {
    const others = await this.prisma.companyMember.count({
      where: {
        companyId,
        role: CompanyRole.OWNER,
        status: CompanyMemberStatus.ACTIVE,
        id: { not: excludingMemberId },
      },
    });
    if (others === 0) {
      throw new BadRequestException(
        'This is the company’s only owner. Make someone else an owner first.',
      );
    }
  }

  private async sendInviteEmail(
    email: string,
    token: string,
    companyName: string,
    role: CompanyRole,
  ) {
    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    //  distinguishes an addressed invitation from a shared join
    // link, so the join page knows which set of rules applies.
    const link = `${base}/employers/join?token=${token}&invite=1`;
    try {
      await this.email.send({
        to: email,
        subject: `Join ${companyName} on Coral`,
        html: `
          <p>You've been invited to join <strong>${companyName}</strong> as a ${ROLE_LABELS[role]}.</p>
          <p><a href="${link}">Accept the invitation</a></p>
          <p>This link expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, ignore this email.</p>
        `,
      });
    } catch (e) {
      // The invitation is already stored — a mail failure must not lose it.
      // It can be resent from the team page.
      this.logger.warn(`Invitation email to ${email} failed: ${(e as Error).message}`);
    }
  }
}
