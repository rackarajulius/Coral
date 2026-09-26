import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PRIVATE_JOB_FIELDS } from '../jobs/job-visibility';

@Injectable()
export class SavedJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMySavedJobs(userId: string, query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      userId,
    };

    const [data, total] = await Promise.all([
      this.prisma.savedJob.findMany({
        where,
        include: {
          job: {
            omit: PRIVATE_JOB_FIELDS,
            include: {
              postedBy: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  role: true,
                  employerProfile: {
                    select: {
                      industry: true,
                      companySize: true,
                      companyDescription: true,
                      overview: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  applications: true,
                  savedBy: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.savedJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async saveJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Idempotent: saving an already-saved job is a no-op (unique userId+jobId).
    const saved = await this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {},
      select: { id: true, jobId: true, createdAt: true },
    });

    return {
      success: true,
      message: 'Job saved successfully',
      data: saved,
    };
  }

  async removeSavedJob(userId: string, identifier: string) {
    const byJobId = await this.prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId: identifier,
        },
      },
      select: {
        id: true,
      },
    });

    if (byJobId) {
      await this.prisma.savedJob.delete({
        where: {
          id: byJobId.id,
        },
      });

      return {
        success: true,
        message: 'Saved job removed successfully',
        data: {
          removed: true,
          id: byJobId.id,
          jobId: identifier,
        },
      };
    }

    const bySavedJobId = await this.prisma.savedJob.findFirst({
      where: {
        id: identifier,
        userId,
      },
      select: {
        id: true,
        jobId: true,
      },
    });

    if (!bySavedJobId) {
      throw new NotFoundException('Saved job not found');
    }

    await this.prisma.savedJob.delete({
      where: {
        id: bySavedJobId.id,
      },
    });

    return {
      success: true,
      message: 'Saved job removed successfully',
      data: {
        removed: true,
        id: bySavedJobId.id,
        jobId: bySavedJobId.jobId,
      },
    };
  }
}
