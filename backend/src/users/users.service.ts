import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { computeProfileCompletion } from '../common/profile-completion';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { User as PrismaUser } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user by ID (public profile)
   */
  async getUserById(userId: string): Promise<Partial<User>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        // Don't expose email, status, etc.
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as Partial<User>;
  }

  /**
   * Get user's full profile based on their role
   */
  async getUserProfile(userId: string, currentUser: User): Promise<PrismaUser & { jobSeekerProfile?: any; employerProfile?: any; freelancerProfile?: any }> {
    // Users can only view their own full profile
    if (userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        jobSeekerProfile: {
          include: {
            experiences: true,
            educations: true,
            certifications: true,
            portfolioItems: true,
          },
        },
        employerProfile: true,
        freelancerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user basic info
   */
  async updateUser(
    userId: string,
    currentUser: User,
    data: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      avatarUrl?: string;
    },
  ): Promise<User> {
    // Users can only update their own profile
    if (userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own profile');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return updatedUser as User;
  }

  /**
   * Search users by name or email (admin only)
   */
  async searchUsers(query: string, limit: number = 20): Promise<Partial<User>[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        email: true,
      },
      take: limit,
    });

    return users as Partial<User>[];
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{ role: string; profileCompletion: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        jobSeekerProfile: {
          select: {
            headline: true,
            summary: true,
            skills: true,
            languages: true,
            city: true,
            state: true,
            country: true,
            _count: {
              select: {
                experiences: true,
                educations: true,
                certifications: true,
                portfolioItems: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const p = user.jobSeekerProfile;

    return {
      role: user.role,
      /**
       * The same weights the candidate's own meter uses.
       *
       * This used to be its own rule — ten unweighted fields that scored the
       * avatar and counted first name, last name and display name as three
       * separate points, while ignoring languages, certifications and
       * portfolio. It reported a different number for the same profile than
       * both the profile page and the admin list did.
       */
      profileCompletion: computeProfileCompletion({
        name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        headline: p?.headline,
        location: [p?.city, p?.state, p?.country].filter(Boolean).join(', '),
        summary: p?.summary,
        languages: p?.languages,
        skills: p?.skills,
        experienceCount: p?._count.experiences,
        educationCount: p?._count.educations,
        certificationCount: p?._count.certifications,
        portfolioCount: p?._count.portfolioItems,
      }),
    };
  }
}
