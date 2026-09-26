import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { createHmac } from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../services/email/email.service';
import { CalendarService } from '../integrations/calendar.service';
import { User } from '../common/types/user.types';
import { buildIcs } from '../integrations/ics.util';
import { ProposeInterviewDto } from './dto/propose-interview.dto';
import { RespondInterviewDto } from './dto/respond-interview.dto';
import { SubmitScorecardDto } from './dto/submit-scorecard.dto';

/** Candidate-facing copy for each interview outcome. */
const OUTCOME_COPY: Record<string, { title: string; blurb: string }> = {
  advancing: { title: 'moving you forward', blurb: "Good news — they'd like to move you to the next step." },
  hired: { title: 'extending an offer', blurb: 'Great news — they want to move ahead with you.' },
  hold: { title: 'putting things on hold', blurb: "They're keeping your application on hold for now." },
  rejected: { title: 'not moving forward', blurb: "They've decided not to move forward this time." },
};

type InterviewRow = NonNullable<Awaited<ReturnType<PrismaService['interview']['findUnique']>>>;

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly calendar: CalendarService,
    private readonly config: ConfigService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** Employer proposes an interview (one or more time slots) to a candidate. */
  async propose(employer: User, dto: ProposeInterviewDto) {
    const candidate = await this.prisma.user.findUnique({
      where: { id: dto.candidateId },
      select: { id: true, email: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const slots = dto.proposedSlots
      .map((s) => new Date(s))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (slots.length === 0) throw new BadRequestException('At least one valid time slot is required');

    const company = await this.employerCompany(employer.id);

    const interview = await this.prisma.interview.create({
      data: {
        employerId: employer.id,
        candidateId: dto.candidateId,
        role: dto.role ?? null,
        medium: dto.medium ?? 'video',
        location: dto.location ?? null,
        meetingLink: dto.meetingLink ?? null,
        proposedSlots: slots.map((d) => d.toISOString()),
        message: dto.message ?? null,
        status: 'proposed',
      },
    });

    // Notify the candidate in-app (+ best-effort email). They accept/decline
    // from their activity page — contact details are never routed around it.
    await this.notifications.create({
      userId: dto.candidateId,
      type: 'interview',
      title: `Interview invitation from ${company}`,
      message: dto.role ? `For the ${dto.role} role — pick a time that works.` : 'Pick a time that works.',
      link: '/activity?tab=interviews',
    });
    if (candidate.email) {
      const when = slots.map((d) => d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })).join('\n- ');
      this.email
        .sendPlainText({
          to: candidate.email,
          subject: `Interview invitation from ${company}`,
          message: `${company} would like to interview you${dto.role ? ` for the ${dto.role} role` : ''}.\n\nProposed time(s):\n- ${when}\n\n${dto.message ?? ''}\n\nRespond from your activity page: /activity?tab=interviews`,
        })
        .catch((err) => this.logger.warn(`Interview email failed: ${err instanceof Error ? err.message : err}`));
    }

    return interview;
  }

  /** Interviews the company has proposed/confirmed, newest first. */
  async listForEmployer(employer: User) {
    return this.prisma.interview.findMany({
      // Company-wide, so an interview booked by a colleague still appears on
      // the shared schedule.
      where: { employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** The candidate's interview invitations + scheduled interviews, enriched with company name. */
  async listForCandidate(candidate: User) {
    const interviews = await this.prisma.interview.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (interviews.length === 0) return [];

    const employerIds = [...new Set(interviews.map((i) => i.employerId))];
    const profiles = await this.prisma.employerProfile.findMany({
      where: { userId: { in: employerIds } },
      select: { userId: true, companyName: true },
    });
    const companyByEmployer = new Map(profiles.map((p) => [p.userId, p.companyName]));

    // Strip the employer-private scorecard; the candidate only ever sees the outcome.
    return interviews.map(({ feedback: _feedback, ...i }) => ({
      ...i,
      company: companyByEmployer.get(i.employerId)?.trim() || 'Employer',
    }));
  }

  /** Candidate accepts (picking a slot) or declines a proposed interview. */
  async respond(candidate: User, interviewId: string, dto: RespondInterviewDto) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidateId: candidate.id },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status !== 'proposed') {
      throw new BadRequestException('This interview has already been responded to.');
    }

    let updated;
    if (dto.action === 'accept') {
      const slots = (interview.proposedSlots as string[] | null) ?? [];
      const chosen = dto.slot && slots.includes(dto.slot) ? dto.slot : slots[0];
      if (!chosen) throw new BadRequestException('No proposed time slots to accept.');
      updated = await this.prisma.interview.update({
        where: { id: interview.id },
        data: { status: 'confirmed', scheduledAt: new Date(chosen) },
      });

      // Auto-create a Google Meet event when the employer has Calendar connected
      // (video interviews without a manual link). Both parties are invited;
      // failure degrades to a confirmed interview without a link.
      if (updated.medium === 'video' && !updated.meetingLink) {
        const employerUser = await this.prisma.user.findUnique({
          where: { id: interview.employerId },
          select: { email: true },
        });
        const company = await this.employerCompany(interview.employerId);
        // Whichever calendar this employer connected — Google Meet or Teams.
        const meet = await this.calendar.createMeeting(interview.employerId, {
          summary: `Interview: ${interview.role ?? 'Interview'} — ${company}`,
          description: interview.message ?? undefined,
          startISO: chosen,
          attendees: [candidate.email, employerUser?.email ?? ''].filter(Boolean) as string[],
        });
        if (meet) {
          updated = await this.prisma.interview.update({
            where: { id: interview.id },
            // The provider is stored with the id so cancelling later deletes
            // from the calendar that actually holds it.
            data: {
              meetingLink: meet.meetLink,
              // Empty when Zoom supplied the link and no calendar is connected.
              calendarEventId: meet.eventId || null,
              calendarProvider: meet.provider,
              zoomMeetingId: meet.zoomMeetingId,
            },
          });
        }
      }
    } else {
      updated = await this.prisma.interview.update({
        where: { id: interview.id },
        data: { status: 'declined' },
      });
    }

    const candidateName = candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'The candidate';
    await this.notifications.create({
      userId: interview.employerId,
      type: 'interview',
      title:
        dto.action === 'accept'
          ? `${candidateName} accepted your interview invitation`
          : `${candidateName} declined your interview invitation`,
      message:
        dto.action === 'accept' && updated.scheduledAt
          ? `Confirmed for ${updated.scheduledAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}.`
          : interview.role ?? '',
      link: '/employers/candidates',
    });

    // On accept, email the candidate a confirmation with the .ics calendar invite.
    if (dto.action === 'accept') {
      await this.sendConfirmationEmail(interview.id);
    }

    return updated;
  }

  /** Employer cancels a proposed/confirmed interview. */
  async cancel(employer: User, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (['cancelled', 'declined', 'completed'].includes(interview.status)) {
      return interview;
    }

    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'cancelled' },
    });

    // Remove whatever backs the meeting — a calendar event, a Zoom meeting,
    // or both. deleteMeeting handles each being absent.
    if (interview.calendarEventId || interview.zoomMeetingId) {
      await this.calendar.deleteMeeting(
        employer.id,
        interview.calendarEventId,
        interview.calendarProvider,
        interview.zoomMeetingId,
      );
    }

    const company = await this.employerCompany(employer.id);
    await this.notifications.create({
      userId: interview.candidateId,
      type: 'interview',
      title: `Interview cancelled by ${company}`,
      message: interview.role ?? '',
      link: '/activity?tab=interviews',
    });

    return updated;
  }

  /**
   * Room metadata for the native (WebRTC) video interview at `/interview/:id/room`.
   * Both the employer and the candidate call this. The signalling channel name is
   * an HMAC of the interview id under a server secret, so it can't be derived from
   * the (public-ish) interview id alone — only validated participants receive it.
   */
  async getRoom(user: User, interviewId: string) {
    const interview = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview) throw new NotFoundException('Interview not found');

    const isEmployer = interview.employerId === user.id;
    const isCandidate = interview.candidateId === user.id;
    if (!isEmployer && !isCandidate && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not a participant in this interview');
    }

    // Admins default to the employer seat; a genuine candidate takes the candidate seat.
    const seat: 'employer' | 'candidate' = isCandidate && !isEmployer ? 'candidate' : 'employer';

    let peerName: string;
    if (seat === 'candidate') {
      peerName = await this.employerCompany(interview.employerId);
    } else {
      const cand = await this.prisma.user.findUnique({
        where: { id: interview.candidateId },
        select: { displayName: true, firstName: true, lastName: true },
      });
      peerName =
        cand?.displayName?.trim() ||
        [cand?.firstName, cand?.lastName].filter(Boolean).join(' ').trim() ||
        'Candidate';
    }

    const secret =
      this.config.get<string>('INTERVIEW_ROOM_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'coral-interview-room';
    const channel = 'room-' + createHmac('sha256', secret).update(interview.id).digest('hex').slice(0, 40);

    return {
      seat,
      peerName,
      channel,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      roleTitle: interview.role,
      medium: interview.medium,
      canJoin: interview.status === 'confirmed',
    };
  }

  /** Builds a `.ics` calendar file for a scheduled interview (null if no time yet). */
  private async buildInterviewIcs(interview: InterviewRow): Promise<string | null> {
    const startISO =
      interview.scheduledAt ??
      (Array.isArray(interview.proposedSlots) ? (interview.proposedSlots[0] as string) : null);
    if (!startISO) return null;

    const company = await this.employerCompany(interview.employerId);
    const [employerUser, candidate] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: interview.employerId }, select: { email: true } }),
      this.prisma.user.findUnique({ where: { id: interview.candidateId }, select: { email: true } }),
    ]);
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:8081').replace(/\/$/, '');
    const roomUrl = interview.medium === 'video' ? `${frontend}/interview/${interview.id}/room` : undefined;
    const link = interview.meetingLink || roomUrl;

    return buildIcs({
      uid: `${interview.id}@coral`,
      title: `Interview${interview.role ? `: ${interview.role}` : ''} — ${company}`,
      description: [interview.message ?? '', link ? `Join: ${link}` : ''].filter(Boolean).join('\n\n') || undefined,
      start: new Date(startISO),
      durationMins: 30,
      location: interview.medium === 'onsite' ? interview.location ?? undefined : link,
      url: link,
      organizerEmail: employerUser?.email ?? undefined,
      attendeeEmail: candidate?.email ?? undefined,
      status: interview.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
    });
  }

  /** Raw `.ics` for download — participant-gated. */
  async getIcs(user: User, interviewId: string): Promise<{ filename: string; content: string }> {
    const interview = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.employerId !== user.id && interview.candidateId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not a participant in this interview');
    }
    const ics = await this.buildInterviewIcs(interview);
    if (!ics) throw new BadRequestException('This interview has no scheduled time yet');
    return { filename: `interview-${interviewId.slice(0, 8)}.ics`, content: ics };
  }

  /** Best-effort confirmation email to the candidate with the calendar invite attached. */
  async sendConfirmationEmail(interviewId: string): Promise<void> {
    const interview = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview?.scheduledAt) return;
    const ics = await this.buildInterviewIcs(interview);
    const candidate = await this.prisma.user.findUnique({
      where: { id: interview.candidateId },
      select: { email: true },
    });
    if (!ics || !candidate?.email) return;

    const company = await this.employerCompany(interview.employerId);
    const when = interview.scheduledAt.toLocaleString('en-CA', { dateStyle: 'full', timeStyle: 'short' });
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:8081').replace(/\/$/, '');
    const link =
      interview.meetingLink || (interview.medium === 'video' ? `${frontend}/interview/${interview.id}/room` : '');

    this.email
      .sendPlainText({
        to: candidate.email,
        subject: `Interview confirmed — ${company}`,
        message:
          `Your interview${interview.role ? ` for the ${interview.role} role` : ''} with ${company} is confirmed for ${when}.` +
          `${link ? `\n\nJoin here: ${link}` : ''}\n\nThe calendar invite is attached — add it to any calendar.`,
        attachments: [
          { filename: 'interview.ics', content: Buffer.from(ics).toString('base64'), contentType: 'text/calendar' },
        ],
      })
      .catch((err) => this.logger.warn(`Confirmation email failed: ${err instanceof Error ? err.message : err}`));
  }

  /** Employer logs a post-interview scorecard (private) + a candidate-visible outcome. */
  async submitScorecard(employer: User, interviewId: string, dto: SubmitScorecardDto) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status === 'cancelled' || interview.status === 'declined') {
      throw new BadRequestException('This interview did not take place.');
    }

    const feedback = {
      ratings: (dto.ratings ?? []).map((r) => ({ label: r.label, score: r.score })),
      recommendation: dto.recommendation ?? null,
      notes: dto.notes ?? null,
    };

    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        feedback: feedback as unknown as Prisma.InputJsonValue,
        outcome: dto.outcome,
        outcomeNote: dto.outcomeNote ?? null,
        outcomeAt: new Date(),
        status: 'completed',
      },
    });

    // No-ghosting: always share the OUTCOME with the candidate — never the private scorecard.
    const copy = OUTCOME_COPY[dto.outcome] ?? OUTCOME_COPY.hold;
    const company = await this.employerCompany(interview.employerId);
    await this.notifications.create({
      userId: interview.candidateId,
      type: 'interview',
      title: `${company}: ${copy.title}`,
      message: dto.outcomeNote?.trim() || copy.blurb,
      link: '/activity?tab=interviews',
    });
    const candidate = await this.prisma.user.findUnique({
      where: { id: interview.candidateId },
      select: { email: true },
    });
    if (candidate?.email) {
      this.email
        .sendPlainText({
          to: candidate.email,
          subject: `Update on your interview with ${company}`,
          message: `${copy.blurb}${dto.outcomeNote?.trim() ? `\n\n${dto.outcomeNote.trim()}` : ''}\n\nSee details: /activity?tab=interviews`,
        })
        .catch((err) => this.logger.warn(`Outcome email failed: ${err instanceof Error ? err.message : err}`));
    }

    return updated;
  }

  /** The employer's private scorecard + outcome for one interview. */
  async getScorecard(employer: User, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, employerId: { in: await this.companyContext.memberUserIds(employer.id) } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return {
      id: interview.id,
      outcome: interview.outcome,
      outcomeNote: interview.outcomeNote,
      feedback: interview.feedback,
    };
  }

  /**
   * No-ghosting enforcement: nudge employers who interviewed a candidate but
   * never shared an outcome. Runs daily; nudges once, then again if still silent.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_9AM, { name: 'interview-outcome-nudge' })
  async nudgeStaleOutcomes() {
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

    const stale = await this.prisma.interview.findMany({
      where: {
        status: 'confirmed',
        outcome: null,
        scheduledAt: { lt: twoDaysAgo },
        OR: [{ nudgedAt: null }, { nudgedAt: { lt: threeDaysAgo } }],
      },
      take: 200,
    });
    if (stale.length === 0) return;

    for (const iv of stale) {
      const candidate = await this.prisma.user.findUnique({
        where: { id: iv.candidateId },
        select: { displayName: true, firstName: true, lastName: true },
      });
      const name =
        candidate?.displayName ||
        [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ') ||
        'a candidate';
      await this.notifications.create({
        userId: iv.employerId,
        type: 'interview',
        title: `Share an update with ${name}`,
        message: `You interviewed ${name}${iv.role ? ` for ${iv.role}` : ''} a few days ago — let them know where they stand.`,
        link: '/employers/candidates',
      });
      await this.prisma.interview.update({ where: { id: iv.id }, data: { nudgedAt: new Date() } });
    }
    this.logger.log(`Nudged ${stale.length} employer(s) about pending interview outcomes.`);
  }

  private async employerCompany(userId: string): Promise<string> {
    const emp = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { companyName: true },
    });
    return emp?.companyName?.trim() || 'An employer';
  }
}
