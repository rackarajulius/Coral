import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto';

@Injectable()
export class FreelancersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(userId: string) {
    const freelancer = await this.prisma.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!freelancer) {
      throw new NotFoundException('Freelancer profile not found');
    }

    return freelancer;
  }

  async getMyProfile(userId: string) {
    return this.getOrCreateProfile(userId);
  }

  async updateMyProfile(userId: string, dto: UpdateFreelancerProfileDto) {
    const profile = await this.getOrCreateProfile(userId);

    return this.prisma.freelancerProfile.update({
      where: { id: profile.id },
      data: {
        ...dto,
      },
    });
  }

  private async getOrCreateProfile(userId: string) {
    let profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      profile = await this.prisma.freelancerProfile.create({
        data: {
          userId,
          skills: [],
          expertise: [],
          currency: 'USD',
          availableForRemote: true,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              emailVerified: true,
              createdAt: true,
            },
          },
        },
      });
    }

    return profile;
  }
}

