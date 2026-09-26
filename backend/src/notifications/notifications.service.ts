import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { EmailService } from '../services/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';

export interface CreateNotificationInput {
  userId: string;
  type?: string;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Emits an in-app notification. Never throws — a notification failure must
   * not roll back or break the action that triggered it.
   */
  async create(input: CreateNotificationInput) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type ?? 'general',
          title: input.title,
          message: input.message,
          link: input.link ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async listMyNotifications(userId: string, limit = 20) {
    const [data, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50),
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { userId, data, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async sendTestEmail(dto: SendTestEmailDto) {
    const subject = dto.subject?.trim() || 'Coral Email Backend Test';
    const message =
      dto.message?.trim() || 'Your email backend is configured and sending through Resend.';

    const delivery = await this.emailService.sendPlainText({
      to: dto.to.trim(),
      subject,
      message,
    });

    return {
      success: true,
      message: 'Test email sent successfully',
      data: delivery,
    };
  }

  /**
   * Prunes old notifications.
   *
   * This table is the one that genuinely grows without bound — every
   * application, screening, review, interview and deadline warning adds a row
   * and nothing ever removed them. Audit logs and analytics events already had
   * retention; this didn't.
   *
   * Read and unread are treated differently on purpose: a read notification has
   * served its purpose, but an unread one is something the person hasn't seen
   * yet, and deleting it means they never will.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_5AM, { name: 'notification-retention' })
  async pruneOldNotifications(): Promise<void> {
    const readDays = this.retentionDays('NOTIFICATION_READ_RETENTION_DAYS', 60);
    const unreadDays = this.retentionDays('NOTIFICATION_UNREAD_RETENTION_DAYS', 180);

    try {
      const [read, unread] = await Promise.all([
        this.prisma.notification.deleteMany({
          where: {
            readAt: { not: null },
            createdAt: { lt: new Date(Date.now() - readDays * 86_400_000) },
          },
        }),
        this.prisma.notification.deleteMany({
          where: {
            readAt: null,
            createdAt: { lt: new Date(Date.now() - unreadDays * 86_400_000) },
          },
        }),
      ]);
      const total = read.count + unread.count;
      if (total > 0) {
        this.logger.log(`Pruned ${total} notifications (${read.count} read, ${unread.count} unread)`);
      }
    } catch (err) {
      this.logger.error(`Notification prune failed: ${(err as Error).message}`);
    }
  }

  /** Env override, floored at a week so a typo can't wipe the table. */
  private retentionDays(key: string, fallback: number): number {
    const n = Number(process.env[key]);
    return Number.isFinite(n) && n >= 7 ? Math.floor(n) : fallback;
  }
}
