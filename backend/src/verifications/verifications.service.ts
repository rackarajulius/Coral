import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, VERIFICATION_BUCKET } from '../storage/storage.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationsQueryDto } from './dto/verifications-query.dto';
import { AuditLogService } from '../admin/audit-log.service';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Uploads a verification document to the PRIVATE bucket and returns its
   * storage path (stored as `documentUrl`). The file is namespaced by user so
   * one user can never reference another's document.
   */
  async uploadDocument(userId: string, file: Express.Multer.File): Promise<string> {
    const ext = (file.mimetype.split('/')[1] || 'bin').replace('jpeg', 'jpg');
    const path = `${userId}/${Date.now()}.${ext}`;
    return this.storageService.uploadPrivateFile(
      path,
      file.buffer,
      file.mimetype,
      VERIFICATION_BUCKET,
    );
  }

  /** Admin-only: mints a short-lived signed URL to view a request's document. */
  async getDocumentUrl(id: string): Promise<string> {
    const verification = await this.prisma.verification.findUnique({ where: { id } });
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    if (!verification.documentUrl) {
      throw new NotFoundException('This request has no document attached');
    }
    return this.storageService.createSignedUrl(verification.documentUrl, VERIFICATION_BUCKET);
  }

  async requestVerification(userId: string, dto: CreateVerificationDto) {
    const needsTarget =
      dto.type === VerificationType.EXPERIENCE || dto.type === VerificationType.EDUCATION;

    if (needsTarget) {
      if (!dto.targetId) {
        throw new BadRequestException('targetId is required for this verification type');
      }
      await this.assertOwnsTarget(userId, dto.type, dto.targetId);
    }

    // A document, if supplied, must be one the user uploaded — our upload
    // endpoint namespaces files under `${userId}/…`, so reject anything else to
    // stop a user attaching another person's document to their request.
    if (dto.documentUrl && !dto.documentUrl.startsWith(`${userId}/`)) {
      throw new BadRequestException('Invalid document reference');
    }

    // One active (pending or approved) request per type + target.
    const existing = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: dto.type,
        targetId: dto.targetId ?? null,
        status: { in: [VerificationStatus.PENDING, VerificationStatus.APPROVED] },
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === VerificationStatus.APPROVED
          ? 'This item is already verified'
          : 'A verification request is already pending for this item',
      );
    }

    return this.prisma.verification.create({
      data: {
        userId,
        type: dto.type,
        targetId: dto.targetId,
        documentUrl: dto.documentUrl,
        note: dto.note,
      },
    });
  }

  async listMyVerifications(userId: string) {
    return this.prisma.verification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async withdraw(userId: string, id: string) {
    const verification = await this.prisma.verification.findUnique({ where: { id } });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    if (verification.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own verification request');
    }
    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be withdrawn');
    }

    await this.prisma.verification.delete({ where: { id } });

    // Best-effort: remove the orphaned private document.
    if (verification.documentUrl) {
      await this.storageService.deletePublicFile(verification.documentUrl, VERIFICATION_BUCKET);
    }
  }

  // --- Admin ---

  async list(query: VerificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.VerificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.verification.findMany({
        where,
        orderBy: { createdAt: 'asc' }, // oldest pending first for review queues
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.verification.count({ where }),
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

  async review(adminId: string, id: string, dto: ReviewVerificationDto) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const updated = await this.prisma.verification.update({
      where: { id },
      data: {
        status: dto.status,
        reviewerNote: dto.reviewerNote,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    // Approving an experience verification flips the experience's verified flag,
    // which the profile UI already renders as a "Verified" badge.
    if (
      dto.status === VerificationStatus.APPROVED &&
      verification.type === VerificationType.EXPERIENCE &&
      verification.targetId
    ) {
      await this.prisma.experience
        .update({ where: { id: verification.targetId }, data: { verified: true } })
        .catch(() => undefined);
    }

    // Approving a company verification is what actually lets an employer post
    // and contact candidates — the record alone changes nothing without this.
    if (
      dto.status === VerificationStatus.APPROVED &&
      verification.type === VerificationType.COMPANY
    ) {
      await this.prisma.employerProfile
        .update({
          where: { userId: verification.userId },
          data: { verificationStatus: 'verified' },
        })
        .catch(() => undefined);
    }

    const requesterName =
      verification.user.displayName ||
      `${verification.user.firstName || ''} ${verification.user.lastName || ''}`.trim() ||
      verification.user.email;
    const typeLabel = verification.type.toLowerCase().replace(/_/g, ' ');
    await this.audit.record({
      adminId,
      action: dto.status === VerificationStatus.APPROVED ? 'Approve' : 'Reject',
      entityType: 'Verification',
      entityId: verification.id,
      entityName: requesterName,
      changeSummary:
        `${typeLabel} verification ${dto.status.toLowerCase()}` +
        (dto.reviewerNote ? ` — ${dto.reviewerNote}` : ''),
      before: { status: verification.status },
      after: { status: dto.status },
    });

    return updated;
  }

  private async assertOwnsTarget(userId: string, type: VerificationType, targetId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Job seeker profile not found');
    }

    if (type === VerificationType.EXPERIENCE) {
      const experience = await this.prisma.experience.findUnique({
        where: { id: targetId },
        select: { profileId: true },
      });
      if (!experience || experience.profileId !== profile.id) {
        throw new ForbiddenException('You can only verify your own experience');
      }
    } else if (type === VerificationType.EDUCATION) {
      const education = await this.prisma.education.findUnique({
        where: { id: targetId },
        select: { profileId: true },
      });
      if (!education || education.profileId !== profile.id) {
        throw new ForbiddenException('You can only verify your own education');
      }
    }
  }
}
