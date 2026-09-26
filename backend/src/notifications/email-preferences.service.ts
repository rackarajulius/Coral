import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_TOPICS, EmailTopic } from './seeker-preferences';

/**
 * One-click unsubscribe for job emails.
 *
 * CASL requires every commercial email to carry an unsubscribe that works
 * without friction — so no sign-in. The link carries the user id and topic
 * with an HMAC over both; forging one needs the server's secret, and the worst
 * a leaked link can do is turn off one kind of email for one person.
 *
 * The link opens a page that POSTs, rather than unsubscribing on GET: mail
 * scanners fetch every link in a message, and a GET that unsubscribes would
 * quietly turn off email for everyone behind such a scanner.
 */
@Injectable()
export class EmailPreferencesService {
  private readonly logger = new Logger(EmailPreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Whether email can actually be sent. Callers skip the email channel otherwise. */
  emailConfigured(): boolean {
    return (
      !!this.config.get<string>('EMAIL_FROM', '').trim() &&
      !!this.config.get<string>('RESEND_API_KEY', '').trim()
    );
  }

  /** The frontend page that confirms and performs the unsubscribe. */
  unsubscribeUrl(userId: string, topic: EmailTopic): string {
    const base = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081').replace(/\/+$/, '');
    const params = new URLSearchParams({ u: userId, t: topic, s: this.sign(userId, topic) });
    return `${base}/unsubscribe?${params.toString()}`;
  }

  /** The footer every job email ends with. */
  footer(userId: string, topic: EmailTopic): string {
    const what = topic === 'job_alerts' ? 'job alert emails' : 'job recommendation emails';
    return [
      '',
      '—',
      `You're receiving this because ${
        topic === 'job_alerts' ? 'you set up a job alert on Coral' : 'you turned on job recommendation emails'
      }.`,
      `Stop ${what}: ${this.unsubscribeUrl(userId, topic)}`,
      'Or change it any time in Settings → Notifications.',
    ].join('\n');
  }

  async unsubscribe(userId: string, topic: string, signature: string) {
    if (!(topic in EMAIL_TOPICS)) throw new BadRequestException('Unknown email type.');
    if (!this.verify(userId, topic as EmailTopic, signature)) {
      throw new BadRequestException('This unsubscribe link is not valid.');
    }

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { notificationSettings: true },
    });
    // No profile means nothing to email and nothing to switch off; say it worked.
    if (!profile) return { topic, unsubscribed: true };

    const current =
      profile.notificationSettings && typeof profile.notificationSettings === 'object'
        ? (profile.notificationSettings as Record<string, unknown>)
        : {};
    const key = EMAIL_TOPICS[topic as EmailTopic];
    await this.prisma.jobSeekerProfile.update({
      where: { userId },
      data: { notificationSettings: { ...current, [key]: false } as Prisma.InputJsonValue },
    });
    this.logger.log(`Unsubscribed ${userId.slice(0, 8)} from ${topic}`);
    return { topic, unsubscribed: true };
  }

  private secret(): string {
    const secret =
      this.config.get<string>('UNSUBSCRIBE_SECRET') || this.config.get<string>('SUPABASE_JWT_SECRET') || '';
    if (!secret) throw new Error('No secret configured for unsubscribe links');
    return secret;
  }

  private sign(userId: string, topic: EmailTopic): string {
    // Prefixed, so this HMAC can never be mistaken for any other use of the key.
    return createHmac('sha256', this.secret())
      .update(`coral-unsubscribe:v1:${userId}:${topic}`)
      .digest('base64url');
  }

  private verify(userId: string, topic: EmailTopic, signature: string): boolean {
    const expected = Buffer.from(this.sign(userId, topic));
    const given = Buffer.from(signature || '');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
