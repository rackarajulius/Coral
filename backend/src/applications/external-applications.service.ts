import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import {
  CreateExternalApplicationDto,
  UpdateExternalApplicationDto,
} from './dto/external-application.dto';

@Injectable()
export class ExternalApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(userId: string) {
    return this.prisma.externalApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async create(userId: string, dto: CreateExternalApplicationDto) {
    const title = dto.title?.trim();
    const company = dto.company?.trim();
    if (!title || !company) throw new BadRequestException('Job title and company are required');
    const url = this.safeUrl(dto.url);
    // All entry points for the same URL (matcher, Coral job, manual entry)
    // resolve to one private tracker row.
    const sourceKey = url
      ? `url:${createHash('sha256').update(url).digest('hex')}`
      : dto.sourceKey?.trim();
    if (!sourceKey) throw new BadRequestException('A job URL is required');
    const status = dto.status ?? 'saved';
    if (status === 'saved' && dto.appliedAt) {
      throw new BadRequestException('A saved job cannot have an application date');
    }
    return this.prisma.externalApplication.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      create: {
        userId,
        sourceKey,
        title,
        company,
        url,
        status,
        appliedAt: status === 'saved' ? null : dto.appliedAt ? new Date(dto.appliedAt) : new Date(),
      },
      update: {}, // Reopening a link must not reset a seeker's status or notes.
    });
  }

  async update(userId: string, id: string, dto: UpdateExternalApplicationDto) {
    const existing = await this.prisma.externalApplication.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('External application not found');
    const status = dto.status ?? existing.status;
    if (status === 'saved' && dto.appliedAt) {
      throw new BadRequestException('A saved job cannot have an application date');
    }
    const nextFollowUp = dto.followUpAt === undefined
      ? existing.followUpAt
      : dto.followUpAt ? new Date(dto.followUpAt) : null;
    const followUpChanged = dto.followUpAt !== undefined &&
      nextFollowUp?.getTime() !== existing.followUpAt?.getTime();
    return this.prisma.externalApplication.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status } : {}),
        ...(dto.appliedAt !== undefined || dto.status !== undefined
          ? {
              appliedAt: status === 'saved'
                ? null
                : dto.appliedAt === null
                  ? null
                  : dto.appliedAt
                    ? new Date(dto.appliedAt)
                    : existing.appliedAt ?? new Date(),
            }
          : {}),
        ...(dto.followUpAt !== undefined
          ? { followUpAt: nextFollowUp, ...(followUpChanged ? { remindedAt: null } : {}) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.externalApplication.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('External application not found');
    return { deleted: true };
  }

  /** In-app reminders for follow-up dates. Claims each row before notifying. */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'external-application-follow-ups' })
  async dispatchFollowUps(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.externalApplication.findMany({
      where: {
        followUpAt: { lte: now },
        remindedAt: null,
        status: { notIn: ['rejected', 'withdrawn', 'offer'] },
      },
      orderBy: { followUpAt: 'asc' },
      take: 100,
    });
    for (const item of due) {
      const claim = await this.prisma.externalApplication.updateMany({
        where: { id: item.id, remindedAt: null, followUpAt: { lte: now } },
        data: { remindedAt: now },
      });
      if (!claim.count) continue;
      const notification = await this.notifications.create({
        userId: item.userId,
        type: 'application',
        title: `Follow up on ${item.title}`,
        message: item.status === 'saved'
          ? `Review the ${item.company} job and update your external tracker.`
          : `Check your ${item.company} application and update your external tracker.`,
        link: '/activity?tab=external',
      });
      if (!notification) {
        await this.prisma.externalApplication.updateMany({
          where: { id: item.id, remindedAt: now },
          data: { remindedAt: null },
        });
      }
    }
  }

  private safeUrl(raw?: string): string | null {
    if (!raw?.trim()) return null;
    try {
      const parsed = new URL(raw.trim());
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
      return parsed.toString();
    } catch {
      throw new BadRequestException('Use a valid http or https job URL');
    }
  }
}
