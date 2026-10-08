import { Injectable, Logger, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateFreelancerProfileDto } from '../freelancers/dto/update-freelancer-profile.dto';
import { User } from '../common/types/user.types';

/** Every new account starts as this role, awaiting onboarding. */
const DEFAULT_NEW_ACCOUNT_ROLE: UserRole = 'JOB_SEEKER';

/** The account types someone may choose for themselves. Never ADMIN. */
const SELF_SERVICE_ROLES: UserRole[] = ['JOB_SEEKER', 'EMPLOYER', 'FREELANCER'];

/** "Last seen" is written at most this often per account. */
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user as User;
  }

  /**
   * Find or create user from Supabase auth data
   */
  async findOrCreateUser(
    supabaseUser: any,
    verifyProvisioningIdentity?: () => Promise<boolean>,
  ): Promise<User> {
    const email = supabaseUser.email;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Administrator provisioning requires an explicit environment setting.
    // A missing or blank value leaves both new and existing accounts alone.
    const defaultAdminEmail = this.configService.get<string>('DEFAULT_ADMIN_EMAIL')?.trim();
    const isDefaultAdmin = !!defaultAdminEmail && email.toLowerCase() === defaultAdminEmail.toLowerCase();

    // First, try to find existing user by supabaseId
    let user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (user) {
      // This runs on every authenticated request. Writing "last seen" each
      // time cost a database round trip per request; everything that reads it
      // works in days or 24-hour windows, so every few minutes is plenty.
      const adminNeedsFix = isDefaultAdmin && (user.role !== 'ADMIN' || user.status !== 'ACTIVE');
      const lastSeenFresh =
        !!user.lastLoginAt && Date.now() - user.lastLoginAt.getTime() < LAST_SEEN_WRITE_INTERVAL_MS;
      if (!adminNeedsFix && lastSeenFresh) {
        return user as User;
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          ...(isDefaultAdmin ? { role: 'ADMIN', status: 'ACTIVE' } : {}),
        },
      });
      return user as User;
    }

    // Accepted tokens can be cached on this or another server. An identity
    // deleted in Supabase must never be provisioned again from that cache.
    if (!verifyProvisioningIdentity || !(await verifyProvisioningIdentity())) {
      throw new UnauthorizedException('This account is no longer available');
    }

    // If not found by supabaseId, check if user exists by email
    // This handles the case where user signed up with email/password first
    user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User exists with same email but different auth method
      // Link this Supabase account to the existing user
      const metadata = supabaseUser.user_metadata || {};

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          supabaseId: supabaseUser.id,
          lastLoginAt: new Date(),
          emailVerified: supabaseUser.email_confirmed_at != null,
          // Update profile data from OAuth if not already set
          ...(user.firstName ? {} : {
            firstName: metadata.first_name || metadata.full_name?.split(' ')[0]
          }),
          ...(user.lastName ? {} : {
            lastName: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.last_name
          }),
          ...(user.displayName ? {} : {
            displayName: metadata.full_name || metadata.name || email.split('@')[0]
          }),
          ...(user.avatarUrl ? {} : {
            avatarUrl: metadata.avatar_url || metadata.picture
          }),
          provider: supabaseUser.app_metadata?.provider || 'email',
          // Ensure default admin has correct role and status
          ...(isDefaultAdmin ? { role: 'ADMIN', status: 'ACTIVE' } : {}),
        },
      });

      this.logger.log(`Linked Supabase account to existing user: ${user.id} (${email})`);
      return user as User;
    }

    // Create new user
    const metadata = supabaseUser.user_metadata || {};
    const provider = supabaseUser.app_metadata?.provider || 'email';

    const createRole = isDefaultAdmin ? 'ADMIN' : DEFAULT_NEW_ACCOUNT_ROLE;
    const createStatus = isDefaultAdmin ? 'ACTIVE' : 'PENDING_ONBOARDING';

    user = await this.prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email,
        emailVerified: supabaseUser.email_confirmed_at != null,
        firstName: metadata.full_name?.split(' ')[0] || metadata.first_name,
        lastName: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.last_name,
        displayName: metadata.full_name || metadata.name || email.split('@')[0],
        avatarUrl: metadata.avatar_url || metadata.picture,
        provider,
        status: createStatus,
        role: createRole,
      },
    });

    this.logger.log(`Created new user via ${provider}: ${user.id} (${email})`);

    return user as User;
  }

  /**
   * Changes an account's type.
   *
   * Admins may set any role on any account. Otherwise the only change allowed
   * is a brand-new account choosing its type, once: every account starts as a
   * job seeker awaiting onboarding, and may become an employer or a freelancer
   * (or stay a job seeker). Never an admin — the role used to be taken straight
   * from the request, so any new sign-up could make itself one.
   *
   * Choosing is not finishing. The status stays PENDING_ONBOARDING until that
   * side's own setup completes it: job seeker onboarding, or employer setup
   * once the company details are in. Marking the account ACTIVE here let every
   * employer who signed up through "Get started" skip the company step.
   */
  async updateUserRole(
    userId: string,
    newRole: UserRole,
    currentUser: User,
  ): Promise<User> {
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // Onboarding and provider setup lock this same row. Check eligibility
      // after acquiring it so a concurrent activation cannot leave a stale
      // pending-account permission to change the person's role.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const targetUser = await tx.user.findUnique({ where: { id: userId } });

      if (!targetUser) {
        throw new BadRequestException('User not found');
      }

      const isAdmin = currentUser.role === 'ADMIN';
      if (!isAdmin) {
        const choosingOwnType = currentUser.id === userId && targetUser.status === 'PENDING_ONBOARDING';
        if (!choosingOwnType) {
          throw new ForbiddenException('You do not have permission to change this user role');
        }
        if (!SELF_SERVICE_ROLES.includes(newRole)) {
          throw new ForbiddenException("That account type can't be chosen here.");
        }
        if (targetUser.role !== newRole && targetUser.role !== DEFAULT_NEW_ACCOUNT_ROLE) {
          throw new ForbiddenException('This account has already chosen its type.');
        }
      }

      return tx.user.update({ where: { id: userId }, data: { role: newRole } });
    });

    this.logger.log(`Updated user ${userId} role to ${newRole}`);

    return updatedUser as User;
  }

  /**
   * Complete onboarding by creating role-specific profile
   */
  async completeOnboarding(
    userId: string,
    role: UserRole,
    profileData: Record<string, unknown> = {},
  ): Promise<User> {
    if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) {
      throw new BadRequestException('Profile data must be an object');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status !== 'PENDING_ONBOARDING') {
      throw new BadRequestException('User has already completed onboarding');
    }

    // Employer setup is finished on the employer side, where the company
    // details are required. Finishing it here created a placeholder company
    // and skipped that step; turning a half-set-up employer into a job seeker
    // here would have left their company attached.
    if (role === 'EMPLOYER' || user.role === 'EMPLOYER') {
      throw new BadRequestException('Employer accounts finish setting up on the employer side.');
    }
    if (role !== 'JOB_SEEKER' && role !== 'FREELANCER') {
      throw new BadRequestException('Invalid role for onboarding');
    }
    if (user.role !== role && user.role !== DEFAULT_NEW_ACCOUNT_ROLE) {
      throw new BadRequestException('This account has already chosen its type.');
    }

    const { userId: _ignoredUserId, ...safeProfileData } = profileData as Record<
      string,
      unknown
    >;
    const safeData = safeProfileData;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // Provider setup and account status transitions share the same row lock.
      // Recheck pending eligibility so concurrent onboarding cannot change a
      // role already selected and activated by another request.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const pending = await tx.user.findUnique({
        where: { id: userId }, select: { role: true, status: true },
      });
      if (!pending || pending.status !== 'PENDING_ONBOARDING' || pending.role === 'EMPLOYER'
        || (pending.role !== role && pending.role !== DEFAULT_NEW_ACCOUNT_ROLE)) {
        throw new BadRequestException('This account cannot complete this onboarding flow');
      }
      await this.createRoleProfile(tx, role, userId, safeData);

      return tx.user.update({
        where: { id: userId },
        data: {
          role,
          status: 'ACTIVE',
        },
      });
    });

    this.logger.log(`User ${userId} completed onboarding as ${role}`);

    return updatedUser as User;
  }

  private async createRoleProfile(
    tx: Prisma.TransactionClient,
    role: UserRole,
    userId: string,
    safeData: Record<string, unknown>,
  ): Promise<void> {
    switch (role) {
      // Upsert (not create) — a profile may already exist if the client hit
      // GET /me/profile first (getOrCreateProfile auto-creates one).
      case 'JOB_SEEKER':
        await tx.jobSeekerProfile.upsert({
          where: { userId },
          create: { ...safeData, userId },
          update: { ...safeData },
        });
        return;

      case 'EMPLOYER':
        await tx.employerProfile.upsert({
          where: { userId },
          create: {
            ...safeData,
            userId,
            companyName: (safeData as any).companyName || 'Company Name',
            jobTitle: (safeData as any).jobTitle || 'Job Title',
          },
          update: { ...safeData },
        });
        return;

      case 'FREELANCER':
        // Onboarding seeds a private draft. Publication belongs to the provider
        // endpoint, which checks completeness and explicit visibility consent.
        if ('publicPreviewEnabled' in safeData || 'providerEnabled' in safeData) {
          throw new BadRequestException('Manage provider visibility after onboarding');
        }
        const providerDraft = plainToInstance(UpdateFreelancerProfileDto, safeData);
        const draftErrors = validateSync(providerDraft, { whitelist: true, forbidNonWhitelisted: true });
        if (draftErrors.length) {
          throw new BadRequestException('Only valid provider work-profile fields may be used for onboarding');
        }
        await tx.freelancerProfile.upsert({
          where: { userId },
          create: {
            ...providerDraft, userId, skills: providerDraft.skills ?? [],
            expertise: providerDraft.expertise ?? [], currency: providerDraft.currency ?? 'CAD',
            providerEnabled: true, publicPreviewEnabled: false,
          },
          update: { ...providerDraft, providerEnabled: true, publicPreviewEnabled: false },
        });
        return;

      default:
        throw new BadRequestException('Invalid role for onboarding');
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string, currentUser: User): Promise<void> {
    // Only the user themselves or an admin can deactivate
    if (currentUser.id !== userId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to deactivate this account');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });

    this.logger.log(`Deactivated user ${userId}`);
  }

  /**
   * Health check for auth service
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }


}
