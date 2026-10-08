import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

/**
 * A single suggested action. `icon` is a lucide icon NAME — the client maps it to
 * a component (components can't cross the wire).
 */
export interface NextAction {
  id: string;
  icon: string;
  title: string;
  desc: string;
  cta: string;
  to: string;
  priority: number;
  highlight?: boolean;
}

const DAY = 86_400_000;

/**
 * Computes "next best actions" from the employer's LIVE state. Every rule fires
 * only when its condition is actually true and writes its copy from real numbers
 * — nothing here is hardcoded advice or an invented statistic.
 */
@Injectable()
export class NextActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async compute(employer: User, limit = 5): Promise<NextAction[]> {
    // Resolved once and passed down: every rule describes the company, and
    // eleven separate membership lookups per dashboard load would be waste.
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    const results = await Promise.all([
      this.unreadMessages(employer, memberIds),
      this.imminentInterview(employer, memberIds),
      this.pendingApplications(employer, memberIds),
      this.screensToReview(employer, memberIds),
      this.unansweredInvites(employer, memberIds),
      this.jobWithoutApplicants(employer, memberIds),
      this.jobMissingSkills(employer, memberIds),
      this.draftJobs(employer, memberIds),
      this.noAvailability(employer, memberIds),
      this.incompleteProfile(employer, memberIds),
      this.googleNotConnected(employer, memberIds),
    ]);

    return results
      .filter((a): a is NextAction => a !== null)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  /* ------------------------------- rules -------------------------------- */

  /** Candidates waiting on a reply (real unread count + how long they've waited). */
  private async unreadMessages(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const convos = await this.prisma.conversation.findMany({
      where: { employerId: { in: memberIds } },
      select: { id: true, employerLastReadAt: true },
    });
    if (convos.length === 0) return null;

    const msgs = await this.prisma.message.findMany({
      where: {
        conversationId: { in: convos.map((c) => c.id) },
        senderId: { not: employer.id },
        createdAt: { gte: new Date(Date.now() - 60 * DAY) },
      },
      select: { conversationId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const lastRead = new Map(convos.map((c) => [c.id, c.employerLastReadAt]));
    const unread = msgs.filter((m) => {
      const lr = lastRead.get(m.conversationId);
      return !lr || m.createdAt > lr;
    });
    if (unread.length === 0) return null;

    const threads = new Set(unread.map((m) => m.conversationId)).size;
    return {
      id: 'unread-messages',
      icon: 'MessageCircle',
      title: `Reply to ${threads} candidate${threads > 1 ? 's' : ''}`,
      desc: `${unread.length} unread message${unread.length > 1 ? 's' : ''} — oldest has been waiting ${this.age(unread[0].createdAt)}.`,
      cta: 'Open chat',
      to: '/employers/chat',
      priority: 100,
    };
  }

  /** An interview happening within 24h. */
  private async imminentInterview(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const iv = await this.prisma.interview.findFirst({
      where: {
        employerId: { in: memberIds },
        status: 'confirmed',
        scheduledAt: { gte: new Date(), lte: new Date(Date.now() + DAY) },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!iv?.scheduledAt) return null;

    const cand = await this.prisma.user.findUnique({
      where: { id: iv.candidateId },
      select: { displayName: true, firstName: true, lastName: true },
    });
    const name =
      cand?.displayName?.trim() ||
      [cand?.firstName, cand?.lastName].filter(Boolean).join(' ').trim() ||
      'a candidate';
    const when = iv.scheduledAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
    const isVideo = iv.medium === 'video';

    return {
      id: 'imminent-interview',
      icon: 'Clock',
      title: `Interview with ${name}`,
      desc: `${when}${iv.role ? ` · ${iv.role}` : ''}.`,
      cta: isVideo ? 'Join room' : 'View details',
      to: isVideo ? `/interview/${iv.id}/room` : '/employers/candidates',
      priority: 98,
      highlight: true,
    };
  }

  /** Applicants still sitting in `pending`. */
  private async pendingApplications(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const rows = await this.prisma.application.findMany({
      where: { status: 'pending', job: { postedById: { in: memberIds } } },
      select: { appliedAt: true },
      orderBy: { appliedAt: 'asc' },
      take: 200,
    });
    if (rows.length === 0) return null;

    return {
      id: 'review-applicants',
      icon: 'UsersRound',
      title: `Review ${rows.length} applicant${rows.length > 1 ? 's' : ''}`,
      desc: `Oldest has been waiting ${this.age(rows[0].appliedAt)} for a first response.`,
      cta: 'Review applicants',
      to: '/employers/candidates',
      priority: 95,
    };
  }

  /** Screenings completed recently (decays after a week so it can't linger forever). */
  private async screensToReview(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const count = await this.prisma.aiScreen.count({
      where: {
        employerId: { in: memberIds },
        status: 'completed',
        completedAt: { gte: new Date(Date.now() - 7 * DAY) },
      },
    });
    if (count === 0) return null;

    return {
      id: 'screens-to-review',
      icon: 'Sparkles',
      title: `${count} screening${count > 1 ? 's' : ''} ready to review`,
      desc: `Completed in the last 7 days — the scorecards are waiting on the candidate's card.`,
      cta: 'Open candidates',
      to: '/employers/candidates',
      priority: 90,
    };
  }

  /** Interview invitations the candidate hasn't answered in 3+ days. */
  private async unansweredInvites(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const count = await this.prisma.interview.count({
      where: {
        employerId: { in: memberIds },
        status: 'proposed',
        createdAt: { lt: new Date(Date.now() - 3 * DAY) },
      },
    });
    if (count === 0) return null;

    return {
      id: 'unanswered-invites',
      icon: 'CalendarClock',
      title: `${count} interview invite${count > 1 ? 's' : ''} unanswered`,
      desc: 'Sent more than 3 days ago with no response — consider a nudge or new times.',
      cta: 'View candidates',
      to: '/employers/candidates',
      priority: 70,
    };
  }

  /** A published job that isn't attracting anyone. */
  private async jobWithoutApplicants(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        postedById: { in: memberIds },
        status: 'published',
        applicationsCount: 0,
        publishedAt: { lt: new Date(Date.now() - 7 * DAY) },
      },
      orderBy: { publishedAt: 'asc' },
      select: { id: true, title: true, publishedAt: true },
    });
    if (!job) return null;

    return {
      id: `job-no-applicants-${job.id}`,
      icon: 'RefreshCcw',
      title: `"${job.title}" has no applicants`,
      desc: `Published ${job.publishedAt ? this.age(job.publishedAt) : '7d'} ago with 0 applications — try broadening the description or required skills.`,
      cta: 'Edit job',
      to: `/employers/jobs/${job.id}/edit`,
      priority: 60,
    };
  }

  /** Jobs with no skills listed — match scores literally can't be computed. */
  private async jobMissingSkills(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const job = await this.prisma.job.findFirst({
      where: { postedById: { in: memberIds }, status: 'published', skills: { isEmpty: true } },
      select: { id: true, title: true },
    });
    if (!job) return null;

    return {
      id: `job-no-skills-${job.id}`,
      icon: 'Zap',
      title: `Add skills to "${job.title}"`,
      desc: "Applicant match scores stay blank until the job lists the skills to match against.",
      cta: 'Add skills',
      to: `/employers/jobs/${job.id}/edit`,
      priority: 55,
    };
  }

  private async draftJobs(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const count = await this.prisma.job.count({ where: { postedById: { in: memberIds }, status: 'draft' } });
    if (count === 0) return null;

    return {
      id: 'draft-jobs',
      icon: 'Briefcase',
      title: `${count} job${count > 1 ? 's' : ''} still in draft`,
      desc: 'Publish to start receiving applications.',
      cta: 'Open jobs',
      to: '/employers/jobs',
      priority: 50,
    };
  }

  private async noAvailability(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const open = await this.prisma.availabilitySlot.count({
      where: { employerId: { in: memberIds }, status: 'open', startAt: { gt: new Date() } },
    });
    if (open > 0) return null;

    return {
      id: 'no-availability',
      icon: 'CalendarClock',
      title: 'Publish interview availability',
      desc: 'Candidates can self-book an open time from your booking link — no back-and-forth.',
      cta: 'Add times',
      to: '/employers/availability',
      priority: 30,
    };
  }

  private async incompleteProfile(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const p = await this.prisma.employerProfile.findUnique({
      where: { userId: employer.id },
      select: {
        companyLogo: true,
        companyDescription: true,
        companyBenefits: true,
        companyLocations: true,
      },
    });
    if (!p) return null;

    const missing = [
      !p.companyLogo && 'logo',
      !p.companyDescription?.trim() && 'description',
      p.companyBenefits.length === 0 && 'benefits',
      p.companyLocations.length === 0 && 'locations',
    ].filter((v): v is string => typeof v === 'string');
    if (missing.length === 0) return null;

    return {
      id: 'incomplete-profile',
      icon: 'Building2',
      title: 'Complete your company profile',
      desc: `Missing ${missing.join(', ')}. Candidates see this on every job you post.`,
      cta: 'Update profile',
      to: '/employers/company',
      priority: 25,
    };
  }

  /** Only suggested when Google is actually configured server-side. */
  private async googleNotConnected(employer: User, memberIds: string[]): Promise<NextAction | null> {
    const configured =
      !!this.config.get<string>('GOOGLE_CLIENT_ID') && !!this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!configured) return null;

    const cred = await this.prisma.googleCredential.findUnique({ where: { userId: employer.id } });
    if (cred) return null;

    return {
      id: 'connect-google',
      icon: 'Video',
      title: 'Connect Google Calendar',
      desc: 'Video interviews get a Meet link automatically when a candidate accepts.',
      cta: 'Connect',
      to: '/employers/integrations',
      priority: 20,
    };
  }

  /* ------------------------------ helpers ------------------------------- */

  private age(d: Date): string {
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (mins < 60) return `${Math.max(mins, 1)}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
