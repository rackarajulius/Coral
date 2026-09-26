import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailPreferencesService } from '../notifications/email-preferences.service';
import { readSeekerPrefs } from '../notifications/seeker-preferences';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { normalizeJobType, normalizeLevel, skillSet } from '../common/job-text';
import {
  CreateJobAlertDto,
  JOB_ALERT_FREQUENCIES,
  JobAlertFrequencyValue,
} from './dto/create-job-alert.dto';
import { ListJobAlertsQueryDto } from './dto/list-job-alerts-query.dto';
import { UpdateJobAlertDto } from './dto/update-job-alert.dto';

type JobAlertWithUser = Prisma.JobAlertGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        status: true;
        jobSeekerProfile: { select: { notificationSettings: true } };
      };
    };
  };
}>;

/**
 * Newest jobs read per alert before keyword matching. Matching happens in
 * memory because skills are stored as typed ("React") and Postgres array
 * containment is case-sensitive — the old `hasSome` never matched a keyword,
 * which the alert stores lower-cased.
 */
const MATCH_SCAN_LIMIT = 500;

type AlertMatch = {
  id: string;
  title: string;
  location: string | null;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
};

@Injectable()
export class JobAlertsService {
  private readonly logger = new Logger(JobAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly emailPrefs: EmailPreferencesService,
  ) {}

  /**
   * Sends whatever alerts are due.
   *
   * Nothing used to run this: a JobAlertsWorker existed but was registered in
   * no module, so alerts only went out when an admin pressed "dispatch". Every
   * ten minutes, because "instant" alerts promise a fifteen-minute wait at
   * most; daily and weekly ones simply are not due on most passes.
   */
  @ExclusiveCron(CronExpression.EVERY_10_MINUTES, { name: 'job-alerts-dispatch' })
  async dispatchScheduled(): Promise<void> {
    // Overlap — a slow pass meeting the next tick, or two servers — is
    // prevented by @ExclusiveCron's lease, not here.
    const { data } = await this.dispatchDueAlerts();
    if (data.notified || data.failed) {
      this.logger.log(`Job alerts: processed=${data.processed} notified=${data.notified} failed=${data.failed}`);
    }
  }

  async listMyAlerts(userId: string, query: ListJobAlertsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.JobAlertWhereInput = {
      userId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.jobAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobAlert.count({ where }),
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

  async createAlert(userId: string, dto: CreateJobAlertDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const created = await this.prisma.jobAlert.create({
      data: {
        userId,
        name,
        keywords: this.normalizeKeywords(dto.keywords),
        location: this.normalizeOptionalText(dto.location),
        jobType: this.normalizeOptionalText(dto.jobType),
        experienceLevel: this.normalizeOptionalText(dto.experienceLevel),
        salaryMin: dto.salaryMin,
        frequency: this.normalizeFrequency(dto.frequency ?? 'daily'),
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Job alert created successfully',
      data: created,
    };
  }

  async updateAlert(userId: string, alertId: string, dto: UpdateJobAlertDto) {
    const existing = await this.prisma.jobAlert.findFirst({
      where: {
        id: alertId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Job alert not found');
    }

    const updated = await this.prisma.jobAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.keywords !== undefined ? { keywords: this.normalizeKeywords(dto.keywords) } : {}),
        ...(dto.location !== undefined ? { location: this.normalizeOptionalText(dto.location) } : {}),
        ...(dto.jobType !== undefined ? { jobType: this.normalizeOptionalText(dto.jobType) } : {}),
        ...(dto.experienceLevel !== undefined
          ? { experienceLevel: this.normalizeOptionalText(dto.experienceLevel) }
          : {}),
        ...(dto.salaryMin !== undefined ? { salaryMin: dto.salaryMin } : {}),
        ...(dto.frequency !== undefined
          ? { frequency: this.normalizeFrequency(dto.frequency) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      success: true,
      message: 'Job alert updated successfully',
      data: updated,
    };
  }

  async deleteAlert(userId: string, alertId: string) {
    const existing = await this.prisma.jobAlert.findFirst({
      where: {
        id: alertId,
        userId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Job alert not found');
    }

    await this.prisma.jobAlert.delete({
      where: { id: alertId },
    });

    return {
      success: true,
      message: 'Job alert deleted successfully',
    };
  }

  async dispatchDueAlerts(options?: {
    force?: boolean;
    limit?: number;
    userId?: string;
    now?: Date;
  }) {
    const now = options?.now ?? new Date();
    const force = options?.force ?? false;
    const dispatchLimit =
      options?.limit ??
      this.readIntConfig('JOB_ALERTS_DISPATCH_LIMIT', 100, {
        min: 1,
        max: 500,
      });
    const matchesPerAlert = this.readIntConfig('JOB_ALERTS_MATCH_LIMIT', 10, {
      min: 1,
      max: 50,
    });

    const where: Prisma.JobAlertWhereInput = {
      isActive: true,
      ...(options?.userId ? { userId: options.userId } : {}),
      ...(force ? {} : this.buildDueAlertFilter(now)),
    };

    const alerts = await this.prisma.jobAlert.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            jobSeekerProfile: { select: { notificationSettings: true } },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: dispatchLimit,
    });

    let processed = 0;
    let notified = 0;
    let skipped = 0;
    let failed = 0;

    for (const alert of alerts) {
      processed += 1;

      if (alert.user.status === UserStatus.SUSPENDED || alert.user.status === UserStatus.INACTIVE) {
        skipped += 1;
        continue;
      }

      const since = this.resolveMatchWindowStart(alert, now);
      const matches = await this.findMatches(alert, since, matchesPerAlert);

      if (matches.length === 0) {
        await this.markAlertSent(alert.id, now);
        skipped += 1;
        continue;
      }

      const delivered = await this.deliver(alert, matches);
      if (delivered === 'failed') {
        // Not marked sent, so the next pass retries the same window.
        failed += 1;
        continue;
      }
      // 'off' also advances the window: the person turned both channels off,
      // and turning one back on should bring new jobs, not a backlog.
      await this.markAlertSent(alert.id, now);
      if (delivered === 'sent') notified += 1;
      else skipped += 1;
    }

    return {
      success: true,
      data: {
        processed,
        notified,
        skipped,
        failed,
      },
    };
  }

  private buildDueAlertFilter(now: Date): Prisma.JobAlertWhereInput {
    const instantCutoff = new Date(
      now.getTime() - this.readIntConfig('JOB_ALERTS_INSTANT_INTERVAL_MIN', 15, { min: 1 }) * 60_000,
    );
    const dailyCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weeklyCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      OR: [
        { lastSentAt: null },
        {
          AND: [{ frequency: 'instant' }, { lastSentAt: { lte: instantCutoff } }],
        },
        {
          AND: [{ frequency: 'daily' }, { lastSentAt: { lte: dailyCutoff } }],
        },
        {
          AND: [{ frequency: 'weekly' }, { lastSentAt: { lte: weeklyCutoff } }],
        },
      ],
    };
  }

  private resolveMatchWindowStart(alert: { frequency: string; lastSentAt: Date | null }, now: Date): Date {
    if (alert.lastSentAt) {
      return alert.lastSentAt;
    }

    const defaultLookbackHours = this.readIntConfig('JOB_ALERTS_DEFAULT_LOOKBACK_HOURS', 24, {
      min: 1,
      max: 24 * 30,
    });

    if (alert.frequency === 'weekly') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    if (alert.frequency === 'daily') {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return new Date(now.getTime() - defaultLookbackHours * 60 * 60 * 1000);
  }

  /**
   * New live jobs that satisfy the alert.
   *
   * Place and pay stay in the query; keywords, job type and level are matched
   * here, in memory, because each is free text the database compares too
   * literally — "React" vs "react" in a skills array, "Full Time" vs
   * "full-time", "Mid Level" vs "mid".
   */
  private async findMatches(alert: JobAlertWithUser, since: Date, limit: number): Promise<AlertMatch[]> {
    const filters: Prisma.JobWhereInput[] = [
      { status: { in: LIVE_JOB_STATUSES } },
      { OR: [{ publishedAt: { gte: since } }, { createdAt: { gte: since } }] },
    ];
    if (alert.location?.trim()) {
      filters.push({ location: { contains: alert.location.trim(), mode: 'insensitive' } });
    }
    if (alert.salaryMin !== null && alert.salaryMin !== undefined) {
      filters.push({ salaryMax: { gte: alert.salaryMin } });
    }

    const jobs = await this.prisma.job.findMany({
      where: { AND: filters },
      select: {
        id: true, title: true, description: true, skills: true, location: true,
        employmentType: true, experienceLevel: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: MATCH_SCAN_LIMIT,
    });

    const keywords = this.normalizeKeywords(alert.keywords);
    const type = normalizeJobType(alert.jobType);
    const level = normalizeLevel(alert.experienceLevel);

    return jobs
      .filter((job) => {
        if (type && normalizeJobType(job.employmentType) !== type) return false;
        // A level the alert names but can't be read is compared as written.
        if (alert.experienceLevel?.trim()) {
          const jobLevel = normalizeLevel(job.experienceLevel);
          if (level ? jobLevel !== level : (job.experienceLevel ?? '').trim().toLowerCase() !== alert.experienceLevel.trim().toLowerCase()) {
            return false;
          }
        }
        if (keywords.length === 0) return true;
        const skills = skillSet(job.skills);
        const text = `${job.title}\n${job.description}`.toLowerCase();
        return keywords.some((k) => skills.has(k) || text.includes(k));
      })
      .slice(0, limit)
      .map(({ description: _d, skills: _s, experienceLevel: _l, ...rest }) => rest);
  }

  /**
   * In-app and/or email, as the person set them in Settings.
   *
   * 'sent' when at least one channel landed; 'off' when both are switched off;
   * 'failed' when every enabled channel failed, so the pass retries.
   */
  private async deliver(alert: JobAlertWithUser, matches: AlertMatch[]): Promise<'sent' | 'off' | 'failed'> {
    const prefs = readSeekerPrefs(alert.user.jobSeekerProfile?.notificationSettings);
    // Email is only a channel when it can actually be sent. Until EMAIL_FROM
    // exists every attempt would throw, and the alert would retry forever.
    const wantEmail = prefs.emailJobAlerts && this.emailPrefs.emailConfigured();
    if (!prefs.pushJobAlerts && !wantEmail) return 'off';

    let landed = false;
    const first = matches[0];
    const plural = matches.length === 1 ? 'job' : 'jobs';

    if (prefs.pushJobAlerts) {
      const note = await this.notifications.create({
        userId: alert.user.id,
        type: 'job_alert',
        title: `${matches.length} new ${plural} for “${alert.name}”`,
        message: matches
          .slice(0, 5)
          .map((m) => `${m.title}${m.location ? ` · ${m.location}` : ''}`)
          .join('\n'),
        link: `/jobs?job=${first.id}&src=alert`,
      });
      landed = landed || note !== null;
    }

    if (wantEmail) {
      try {
        await this.sendAlertEmail(alert, matches);
        landed = true;
      } catch (error) {
        this.logger.error(
          `Job alert email ${alert.id} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    return landed ? 'sent' : 'failed';
  }

  private async sendAlertEmail(alert: JobAlertWithUser, matches: AlertMatch[]) {
    const base = (this.configService.get<string>('FRONTEND_URL') || '').replace(/\/+$/, '');
    const lines = matches.map((job, index) => {
      const location = job.location ? ` | ${job.location}` : '';
      const type = job.employmentType ? ` | ${job.employmentType}` : '';
      const salary =
        job.salaryMin || job.salaryMax
          ? ` | ${job.salaryCurrency} ${job.salaryMin ?? '?'} - ${job.salaryMax ?? '?'}`
          : '';
      return `${index + 1}. ${job.title}${location}${type}${salary}\n   ${base}/jobs?job=${job.id}&src=alert`;
    });

    const body = [
      `Hi,`,
      ``,
      `We found ${matches.length} new matching job(s) for your alert "${alert.name}".`,
      ``,
      ...lines,
      ``,
      `- Coral`,
      this.emailPrefs.footer(alert.user.id, 'job_alerts'),
    ].join('\n');

    await this.emailService.sendPlainText({
      to: alert.user.email,
      subject: `New matches for your alert: ${alert.name}`,
      message: body,
    });
  }


  private async markAlertSent(alertId: string, sentAt: Date) {
    await this.prisma.jobAlert.update({
      where: { id: alertId },
      data: { lastSentAt: sentAt },
    });
  }

  private normalizeKeywords(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of values) {
      const cleaned = value.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!cleaned || seen.has(cleaned)) {
        continue;
      }
      seen.add(cleaned);
      normalized.push(cleaned);
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeFrequency(value: string): JobAlertFrequencyValue {
    const normalized = value.trim().toLowerCase();
    if (!JOB_ALERT_FREQUENCIES.includes(normalized as JobAlertFrequencyValue)) {
      throw new BadRequestException(
        `Invalid frequency. Allowed values: ${JOB_ALERT_FREQUENCIES.join(', ')}`,
      );
    }
    return normalized as JobAlertFrequencyValue;
  }

  private readIntConfig(
    key: string,
    fallback: number,
    options?: {
      min?: number;
      max?: number;
    },
  ): number {
    const raw = this.configService.get<string>(key, `${fallback}`);
    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    const floored = Math.floor(parsed);
    if (options?.min !== undefined && floored < options.min) {
      return options.min;
    }
    if (options?.max !== undefined && floored > options.max) {
      return options.max;
    }
    return floored;
  }
}
