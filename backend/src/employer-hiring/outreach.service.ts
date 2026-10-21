import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OutreachResponse } from '@prisma/client';
import { CompanyContextService } from '../company/company-context.service';
import { roleHasCapability } from '../company/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, OutreachDraft } from '../services/ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../services/email/email.service';
import { User } from '../common/types/user.types';
import { DraftOutreachDto } from './dto/draft-outreach.dto';
import { SendOutreachDto } from './dto/send-outreach.dto';
import { OutreachFromTemplateDto } from './dto/outreach-from-template.dto';
import { renderTemplate, unfilledTokens } from '../ats/email-templates.service';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { adviseTiming, inWorkingHours, isValidTimezone, localMoment } from './outreach-timing';

const DAY_MS = 86_400_000;
/** The stats look back this far. */
const STATS_WINDOW_DAYS = 90;
/** Messages younger than this are counted as sent but not yet judged. */
const SETTLE_DAYS = 2;
/** A page of candidate cards, not the whole pipeline. */
const MAX_CONTACTED_LOOKUP = 60;
/** How far ahead a message may be scheduled. */
const MAX_SCHEDULE_DAYS = 14;
/** A message left 'sending' this long was abandoned by a run that died. */
const STALE_SENDING_MS = 30 * 60_000;
/** Judged, timezone-known approaches needed before reply rates by send time mean anything. */
const TIMING_MIN_SAMPLE = 30;
/** And per group compared. */
const TIMING_MIN_GROUP = 10;

const RESPONSE_HEADLINE: Record<OutreachResponse, (name: string) => string> = {
  INTERESTED: (name) => `${name} is interested`,
  NOT_NOW: (name) => `${name} said not right now`,
  NOT_INTERESTED: (name) => `${name} is not interested`,
};

interface CandidateForOutreach {
  email: string | null;
  summary: { name: string; role: string; company: string; skills: string[]; yearsExp: number };
  /** From their own browser; null until they have used Coral since this was recorded. */
  timezone: string | null;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** AI-draft an editable outreach message for a candidate. */
  async draft(user: User, dto: DraftOutreachDto): Promise<OutreachDraft> {
    const candidate = await this.loadCandidate(dto.candidateId);
    if (!candidate) throw new NotFoundException('Candidate not available.');
    const company = await this.employerCompany(user.id);
    return this.ai.generateOutreach({
      role: dto.role || candidate.summary.role,
      company,
      candidate: candidate.summary,
      tone: dto.tone,
    });
  }

  /**
   * One of the company's saved templates, filled in for this candidate.
   *
   * The same tokens and the same renderer as bulk messages to applicants. A
   * sourced candidate has no job, so `{{job_title}}` takes the project's role
   * when one is given and otherwise stays visible — the recruiter fills it in,
   * and `send` refuses anything still left as `{{…}}`.
   */
  async fromTemplate(user: User, dto: OutreachFromTemplateDto) {
    const context = await this.companyContext.requireForUser(user.id);
    const template = await this.prisma.emailTemplate.findUnique({ where: { id: dto.templateId } });
    // Another company's template reads as missing, not forbidden.
    if (!template || template.companyId !== context.companyId) {
      throw new NotFoundException('Template not found');
    }
    const candidate = await this.loadCandidate(dto.candidateId);
    if (!candidate) throw new NotFoundException('Candidate not available.');

    const values: Record<string, string> = {
      candidate_name: candidate.summary.name,
      company_name: context.companyName,
      ...(dto.jobTitle?.trim() ? { job_title: dto.jobTitle.trim() } : {}),
    };
    const subject = renderTemplate(template.subject, values);
    const message = renderTemplate(template.body, values);
    return {
      templateId: template.id,
      subject,
      message,
      /** Placeholders the recruiter still has to replace before this can be sent. */
      unfilled: unfilledTokens(`${subject}\n${message}`),
    };
  }

  /** Sends the (edited) outreach via in-app notification + email. Consent-gated. */
  async send(user: User, dto: SendOutreachDto) {
    // A template placeholder left in reaches the candidate as "Hi {{candidate_name}}".
    const left = unfilledTokens(`${dto.subject}\n${dto.message}`);
    if (left.length > 0) {
      throw new BadRequestException(`Replace ${left.join(', ')} before sending.`);
    }

    const candidate = await this.loadCandidate(dto.candidateId);
    if (!candidate) throw new NotFoundException('Candidate not available.');

    // Held until their working hours: written now, delivered by the scheduled job.
    if (dto.scheduledFor) {
      const at = new Date(dto.scheduledFor);
      const now = Date.now();
      if (Number.isNaN(at.getTime()) || at.getTime() < now + 60_000) {
        throw new BadRequestException('Pick a time at least a minute from now, or send it now.');
      }
      if (at.getTime() > now + MAX_SCHEDULE_DAYS * DAY_MS) {
        throw new BadRequestException(`A message can be scheduled up to ${MAX_SCHEDULE_DAYS} days ahead.`);
      }
      const log = await this.prisma.outreachMessage.create({
        data: {
          employerId: user.id,
          candidateId: dto.candidateId,
          role: dto.role ?? null,
          subject: dto.subject,
          message: dto.message,
          channel: 'notification',
          status: 'scheduled',
          scheduledFor: at,
        },
      });
      return { success: true, id: log.id, channel: null, scheduledFor: at.toISOString() };
    }

    // Logged first so the notification can point at it: the candidate needs
    // somewhere to answer, and the notifications list was not that place.
    const log = await this.prisma.outreachMessage.create({
      data: {
        employerId: user.id,
        candidateId: dto.candidateId,
        role: dto.role ?? null,
        subject: dto.subject,
        message: dto.message,
        channel: 'notification',
        // Written as sent: it is being delivered right now, and a failure
        // part-way must not leave it where the candidate can never open it.
        status: 'sent',
        sentAt: new Date(),
        candidateTimezone: candidate.timezone,
      },
    });
    const channel = await this.deliver(log, candidate);
    return { success: true, id: log.id, channel, scheduledFor: null };
  }

  /**
   * Puts one message in front of the candidate: in-app, plus email where there
   * is an address. Shared by "send now" and the scheduled job, so a scheduled
   * message arrives exactly as an immediate one would.
   */
  private async deliver(
    log: { id: string; employerId: string; candidateId: string; subject: string; message: string },
    candidate: CandidateForOutreach,
  ): Promise<string> {
    const company = (await this.employerCompany(log.employerId)) || 'An employer';

    await this.notifications.create({
      userId: log.candidateId,
      type: 'outreach',
      title: `New message from ${company}`,
      message: log.subject,
      link: `/outreach/${log.id}`,
    });

    // Email — sent server-side; the candidate's address is never exposed to the employer.
    let channel = 'notification';
    if (candidate.email) {
      const body = `${log.message}\n\n— Sent through Coral on behalf of ${company}. They found your profile in a candidate search; Coral sent this for them, and your email address was not shared with them. To stop appearing in those searches, turn off "Appear in recruiter searches" in your privacy settings.`;
      try {
        await this.email.sendPlainText({ to: candidate.email, subject: log.subject, message: body });
        channel = 'both';
      } catch (err) {
        this.logger.warn(`Outreach email failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    await this.prisma.outreachMessage.update({
      where: { id: log.id },
      data: {
        channel,
        status: 'sent',
        sentAt: new Date(),
        // Their zone at the moment it arrived — what reply-time stats will read.
        candidateTimezone: candidate.timezone,
      },
    });
    return channel;
  }

  /**
   * Delivers scheduled messages whose time has come.
   *
   * Each row is claimed ('scheduled' → 'sending') before it is sent, so a
   * message is never delivered twice. Someone who stopped being discoverable
   * while it waited does not receive it; the recruiter is told instead.
   */
  @ExclusiveCron(CronExpression.EVERY_5_MINUTES, { name: 'outreach-scheduled-delivery' })
  async deliverScheduled(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.outreachMessage.findMany({
      where: {
        OR: [
          { status: 'scheduled', scheduledFor: { lte: now } },
          // A run that died mid-send: retried once it is clearly abandoned.
          { status: 'sending', scheduledFor: { lte: new Date(now.getTime() - STALE_SENDING_MS) } },
        ],
      },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
    });

    for (const row of due) {
      const { count } = await this.prisma.outreachMessage.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: 'sending' },
      });
      if (count === 0) continue; // cancelled, or claimed, since it was read

      try {
        // Scheduling grants no lasting permission. Recheck the sender after
        // claiming the row, including old queued messages and restart retries.
        if (!await this.scheduledSenderAllowed(row.employerId)) {
          await this.prisma.outreachMessage.update({ where: { id: row.id }, data: { status: 'cancelled' } });
          continue;
        }
        const candidate = await this.loadCandidate(row.candidateId);
        if (!candidate) {
          await this.prisma.outreachMessage.update({ where: { id: row.id }, data: { status: 'cancelled' } });
          await this.notifications.create({
            userId: row.employerId,
            type: 'outreach',
            title: 'Scheduled message not sent',
            message: `"${row.subject}" wasn't delivered — that person is no longer available to contact.`,
          });
          continue;
        }
        await this.deliver(row, candidate);
      } catch (err) {
        // Back to the queue for the next pass.
        await this.prisma.outreachMessage
          .update({ where: { id: row.id }, data: { status: 'scheduled' } })
          .catch(() => undefined);
        this.logger.error(`Scheduled outreach ${row.id} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async scheduledSenderAllowed(userId: string): Promise<boolean> {
    const sender = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!sender || sender.status !== 'ACTIVE') return false;
    if (sender.role === 'ADMIN') return true;
    if (sender.role !== 'EMPLOYER') return false;
    const seat = await this.companyContext.membershipFor(userId);
    if (seat && (seat.status !== 'ACTIVE' || !roleHasCapability(seat.role, 'messaging:write'))) return false;
    const profile = await this.prisma.employerProfile.findUnique({ where: { userId }, select: { verificationStatus: true } });
    return !!profile && ['domain_verified', 'verified'].includes(profile.verificationStatus);
  }

  /** Stops a scheduled message before it goes out. Anyone in the company may. */
  async cancelScheduled(user: User, id: string) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const row = await this.prisma.outreachMessage.findUnique({ where: { id } });
    if (!row || !memberIds.includes(row.employerId)) throw new NotFoundException('Message not found');
    const { count } = await this.prisma.outreachMessage.updateMany({
      where: { id, status: 'scheduled' },
      data: { status: 'cancelled' },
    });
    if (count === 0) throw new BadRequestException('That message has already gone out, or was cancelled.');
    return { id, status: 'cancelled' };
  }

  /** When a message to this candidate would land in their working hours. */
  async timing(candidateId: string) {
    const candidate = await this.loadCandidate(candidateId);
    if (!candidate) throw new NotFoundException('Candidate not available.');
    return adviseTiming(candidate.timezone);
  }

  /* ------------------------------------------------------------------------ */
  /*  The candidate's side                                                     */
  /* ------------------------------------------------------------------------ */

  /**
   * One approach, as the person it was sent to sees it.
   *
   * Opening it here is the only "open" recorded. Email opens are not tracked —
   * that means a tracking pixel, and a recruiter's open rate is not worth
   * surveilling someone's inbox for.
   */
  async readForCandidate(candidateId: string, outreachId: string) {
    const row = await this.prisma.outreachMessage.findUnique({ where: { id: outreachId } });
    // Someone else's approach is a 404, not a 403: saying it exists is itself
    // telling them something about another person.
    // Not theirs, or not delivered yet (scheduled, cancelled): as if it did not exist.
    if (!row || row.candidateId !== candidateId || row.status !== 'sent') {
      throw new NotFoundException('Message not found');
    }

    if (!row.openedAt) {
      await this.prisma.outreachMessage.update({
        where: { id: row.id },
        data: { openedAt: new Date() },
      });
    }

    return {
      id: row.id,
      from: (await this.employerCompany(row.employerId)) || 'An employer',
      role: row.role,
      subject: row.subject,
      message: row.message,
      sentAt: row.sentAt ?? row.createdAt,
      response: row.response,
      respondedAt: row.respondedAt,
      responseNote: row.responseNote,
      conversationId: row.conversationId,
    };
  }

  /**
   * The candidate answers.
   *
   * "Interested" opens a conversation with the company. Saying yes to an
   * approach is consent to be written to — more explicit than an application,
   * which is what licenses messaging otherwise — and without a thread the
   * answer would lead nowhere: the recruiter would see "interested" and have no
   * way to reply.
   *
   * An answer can be changed. Someone who said "not now" in March may mean
   * "yes" in June, and making them wait for another approach helps nobody.
   */
  async respond(
    candidateId: string,
    outreachId: string,
    response: OutreachResponse,
    note?: string,
  ) {
    const row = await this.prisma.outreachMessage.findUnique({ where: { id: outreachId } });
    // Not theirs, or not delivered yet (scheduled, cancelled): as if it did not exist.
    if (!row || row.candidateId !== candidateId || row.status !== 'sent') {
      throw new NotFoundException('Message not found');
    }

    let conversationId = row.conversationId;
    if (response === OutreachResponse.INTERESTED && !conversationId) {
      conversationId = await this.openConversation(row.employerId, candidateId);
    }

    const updated = await this.prisma.outreachMessage.update({
      where: { id: row.id },
      data: {
        response,
        respondedAt: new Date(),
        // Answering is opening it, even if the list view was skipped.
        openedAt: row.openedAt ?? new Date(),
        responseNote: note?.trim() || null,
        conversationId,
      },
    });

    // The recruiter who wrote hears the answer, whichever it is. A "no" is as
    // useful as a "yes": it is how they know to stop.
    const name = await this.candidateName(candidateId);
    await this.notifications.create({
      userId: row.employerId,
      type: 'outreach',
      title: RESPONSE_HEADLINE[response](name),
      message: note?.trim() || row.subject,
      link: conversationId ? `/employers/chat?c=${conversationId}` : '/employers/hiring',
    });

    return {
      response: updated.response,
      respondedAt: updated.respondedAt,
      conversationId: updated.conversationId,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*  What the company sees                                                    */
  /* ------------------------------------------------------------------------ */

  /**
   * How approaches are landing, company-wide.
   *
   * Opens are opens *in Coral* and the figures say so. Rates are over messages
   * sent more than two days ago, so this morning's batch — which nobody has had
   * a chance to read — does not drag the reply rate down.
   */
  /**
   * Every approach this company has made to one person, and what came back.
   *
   * The aggregate rates answer "are we any good at this"; this answers "what
   * happened with *them*", which is the question actually being asked when a
   * recruiter opens someone's profile. Without it the only trace of a reply was
   * a notification that scrolled away, and the board's "sent" marker was
   * browser state that vanished on refresh.
   *
   * Scoped to the company, not the sender: a colleague's approach is very much
   * this recruiter's business before they send another one.
   */
  async forCandidate(user: User, candidateId: string) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const rows = await this.prisma.outreachMessage.findMany({
      // Cancelled ones never reached anyone; scheduled ones are shown as such.
      where: { candidateId, employerId: { in: memberIds }, status: { not: 'cancelled' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (rows.length === 0) return { messages: [] };

    const senders = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.employerId))] } },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    });
    const nameById = new Map(
      senders.map((s) => [
        s.id,
        s.displayName?.trim() || [s.firstName, s.lastName].filter(Boolean).join(' ').trim() || 'A colleague',
      ]),
    );

    return {
      messages: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        role: r.role,
        sentAt: r.sentAt ?? r.createdAt,
        /** Set while it waits for their working hours; null once delivered. */
        scheduledFor: r.status === 'scheduled' || r.status === 'sending' ? r.scheduledFor : null,
        status: r.status === 'sending' ? 'scheduled' : r.status,
        sentBy: nameById.get(r.employerId) ?? 'A colleague',
        sentByMe: r.employerId === user.id,
        /**
         * Opened **in Coral** only. Reported as a nullable timestamp rather
         * than a boolean so the UI can say "not opened in Coral" instead of
         * "not opened" — they may well have read the email.
         */
        openedAt: r.openedAt,
        respondedAt: r.respondedAt,
        response: r.response,
        responseNote: r.responseNote,
        conversationId: r.conversationId,
      })),
    };
  }

  /**
   * Who among these people has already been approached, and how it went.
   *
   * One request for a page of candidates rather than one per card. The
   * workspace used to mark "sent" from browser state keyed by *name*, so the
   * marker vanished on refresh and two people with the same name shared it.
   */
  async contactedAmong(user: User, candidateIds: string[]) {
    const ids = [...new Set(candidateIds)].slice(0, MAX_CONTACTED_LOOKUP);
    if (ids.length === 0) return {};

    const memberIds = await this.companyContext.memberUserIds(user.id);
    const rows = await this.prisma.outreachMessage.findMany({
      // A scheduled message counts: the point of this marker is that nobody
      // approaches the same person twice, and one is already on its way.
      where: { candidateId: { in: ids }, employerId: { in: memberIds }, status: { not: 'cancelled' } },
      orderBy: { createdAt: 'desc' },
      select: {
        candidateId: true, createdAt: true, sentAt: true, status: true, scheduledFor: true,
        response: true, respondedAt: true,
      },
    });

    // Newest first, so the first row seen for a candidate is the latest.
    const out: Record<
      string,
      { sentAt: Date; scheduledFor: Date | null; response: OutreachResponse | null; answered: boolean }
    > = {};
    for (const r of rows) {
      if (out[r.candidateId]) continue;
      const pending = r.status === 'scheduled' || r.status === 'sending';
      out[r.candidateId] = {
        sentAt: r.sentAt ?? r.createdAt,
        scheduledFor: pending ? r.scheduledFor : null,
        response: r.response,
        answered: !!r.respondedAt,
      };
    }
    return out;
  }

  async stats(user: User) {
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const since = new Date(Date.now() - STATS_WINDOW_DAYS * DAY_MS);
    const settled = new Date(Date.now() - SETTLE_DAYS * DAY_MS);

    const delivered = await this.prisma.outreachMessage.findMany({
      // Only what reached someone: a scheduled message has not been sent, and
      // counting it would pull the reply rate down for no reason.
      where: { employerId: { in: memberIds }, status: 'sent', createdAt: { gte: since } },
      select: {
        createdAt: true, sentAt: true, candidateTimezone: true,
        openedAt: true, respondedAt: true, response: true,
      },
    });
    const rows = delivered.map((r) => ({ ...r, createdAt: r.sentAt ?? r.createdAt }));

    const judged = rows.filter((r) => r.createdAt <= settled);
    const pct = (n: number, of: number) => (of === 0 ? null : Math.round((n / of) * 100));
    const responded = judged.filter((r) => r.respondedAt);

    return {
      windowDays: STATS_WINDOW_DAYS,
      sent: rows.length,
      /** How many the rates below are drawn from. */
      judged: judged.length,
      openRate: pct(judged.filter((r) => r.openedAt).length, judged.length),
      replyRate: pct(responded.length, judged.length),
      /** Of those who answered, how many said yes. */
      interestedRate: pct(
        responded.filter((r) => r.response === OutreachResponse.INTERESTED).length,
        responded.length,
      ),
      breakdown: {
        interested: rows.filter((r) => r.response === OutreachResponse.INTERESTED).length,
        notNow: rows.filter((r) => r.response === OutreachResponse.NOT_NOW).length,
        notInterested: rows.filter((r) => r.response === OutreachResponse.NOT_INTERESTED).length,
        waiting: rows.filter((r) => !r.respondedAt).length,
      },
      timing: this.timingStats(judged),
    };
  }

  /**
   * Reply rate by the candidate's local send time: inside their working hours
   * or outside them.
   *
   * This is the "learning" half of the timing suggestion, and it stays silent
   * until it has something to say — below TIMING_MIN_SAMPLE judged messages
   * with a known timezone, or TIMING_MIN_GROUP in either group, a rate is one
   * person's afternoon, not a pattern.
   */
  private timingStats(judged: { createdAt: Date; candidateTimezone: string | null; respondedAt: Date | null }[]) {
    const known = judged.filter((r) => isValidTimezone(r.candidateTimezone));
    const groups = { inHours: { sent: 0, replied: 0 }, outOfHours: { sent: 0, replied: 0 } };
    for (const r of known) {
      const g = inWorkingHours(localMoment(r.createdAt, r.candidateTimezone!)) ? groups.inHours : groups.outOfHours;
      g.sent += 1;
      if (r.respondedAt) g.replied += 1;
    }
    const enough =
      known.length >= TIMING_MIN_SAMPLE &&
      groups.inHours.sent >= TIMING_MIN_GROUP &&
      groups.outOfHours.sent >= TIMING_MIN_GROUP;
    const rate = (g: { sent: number; replied: number }) => Math.round((g.replied / g.sent) * 100);
    return {
      withTimezone: known.length,
      minSample: TIMING_MIN_SAMPLE,
      /** Null until there is enough to compare. */
      comparison: enough
        ? {
            inHours: { sent: groups.inHours.sent, replyRate: rate(groups.inHours) },
            outOfHours: { sent: groups.outOfHours.sent, replyRate: rate(groups.outOfHours) },
          }
        : null,
    };
  }

  /**
   * Opens — or reuses — the company's thread with this person.
   *
   * Reuses a colleague's thread when there is one, for the reason
   * MessagingService.startConversation does: two parallel conversations from
   * one company means neither recruiter sees what the other said.
   */
  private async openConversation(employerId: string, candidateId: string): Promise<string> {
    const memberIds = await this.companyContext.memberUserIds(employerId);
    const existing = await this.prisma.conversation.findFirst({
      where: { candidateId, employerId: { in: memberIds } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const convo = await this.prisma.conversation.upsert({
      where: { employerId_candidateId: { employerId, candidateId } },
      create: { employerId, candidateId },
      update: {},
      select: { id: true },
    });
    return convo.id;
  }

  private async candidateName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true },
    });
    return (
      u?.displayName?.trim() ||
      [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() ||
      'A candidate'
    );
  }

  /**
   * Loads a candidate for outreach — only if they can be discovered.
   *
   * This has to agree with `CandidateSourcingService.matchWhere`. When it
   * gated on `openToWork` and search had widened past it, a recruiter could
   * find someone in a search and then be told the candidate "is not available"
   * on the only action the results page offers.
   */
  private async loadCandidate(candidateId: string): Promise<CandidateForOutreach | null> {
    const p = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: candidateId },
      include: {
        user: { select: { email: true, displayName: true, firstName: true, lastName: true } },
        experiences: { orderBy: { startDate: 'asc' } },
      },
    });
    const privacy = (p?.privacySettings ?? {}) as { profileVisible?: boolean };
    if (!p || !p.discoverable || privacy.profileVisible === false) return null;

    const name =
      p.user.displayName || [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || 'there';
    const starts = p.experiences.map((e) => e.startDate).filter((d): d is Date => !!d);
    const yearsExp =
      starts.length === 0
        ? 0
        : Math.max(0, Math.round((Date.now() - Math.min(...starts.map((d) => d.getTime()))) / (365.25 * 864e5)));

    return {
      email: p.user.email,
      timezone: isValidTimezone(p.timezone) ? p.timezone : null,
      summary: {
        name,
        role: p.currentTitle || p.headline || 'Professional',
        company: p.currentCompany || '',
        skills: (p.skills ?? []).slice(0, 8),
        yearsExp,
      },
    };
  }

  private async employerCompany(userId: string): Promise<string> {
    const emp = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { companyName: true },
    });
    return emp?.companyName?.trim() || '';
  }
}
