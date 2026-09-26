import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MESSAGE_ATTACHMENT_BUCKET, StorageService } from '../storage/storage.service';
import { AiService } from '../services/ai/ai.service';
import { User } from '../common/types/user.types';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AssistMessageDto } from './dto/assist-message.dto';

type ConversationRow = NonNullable<Awaited<ReturnType<PrismaService['conversation']['findUnique']>>>;

interface StoredAttachment {
  name: string;
  type: string;
  size: string;
  path: string;
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** AI assist for the composer: draft a reply/action, rewrite a tone, or summarize the thread. */
  async assist(user: User, conversationId: string, dto: AssistMessageDto) {
    const convo = await this.requireParticipant(user, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    rows.reverse();
    const transcript = rows.map((m) => ({
      sender: (m.senderId === convo.employerId ? 'employer' : 'candidate') as 'employer' | 'candidate',
      text: m.body,
    }));

    let role = '';
    if (convo.jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: convo.jobId }, select: { title: true } });
      role = job?.title ?? '';
    }

    if (dto.action === 'summary') {
      return { summary: await this.ai.summarizeConversation(transcript) };
    }
    const text = await this.ai.draftConversationReply({
      action: dto.action,
      tone: dto.tone,
      baseDraft: dto.baseDraft,
      role,
      transcript,
    });
    return { text };
  }

  /** The user's conversations (either side), newest activity first, enriched for the UI. */
  async listConversations(user: User) {
    // The employer side is company-wide: a candidate wrote to the company, not
    // to one recruiter, and whoever picks the thread up next needs to see what
    // was already said. The candidate side stays strictly personal.
    const employerIds = await this.companyContext.memberUserIds(user.id);
    const convos = await this.prisma.conversation.findMany({
      where: { OR: [{ employerId: { in: employerIds } }, { candidateId: user.id }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (convos.length === 0) return [];

    const isEmployerSideOf = (employerId: string) => employerIds.includes(employerId);
    const peerIds = convos.map((c) => (isEmployerSideOf(c.employerId) ? c.candidateId : c.employerId));
    const [users, employers, seekers, unreads] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: peerIds } },
        select: { id: true, displayName: true, firstName: true, lastName: true },
      }),
      this.prisma.employerProfile.findMany({
        where: { userId: { in: peerIds } },
        select: { userId: true, companyName: true },
      }),
      this.prisma.jobSeekerProfile.findMany({
        where: { userId: { in: peerIds } },
        select: { userId: true, currentTitle: true, headline: true },
      }),
      Promise.all(
        convos.map((c) => {
          const lastRead = isEmployerSideOf(c.employerId) ? c.employerLastReadAt : c.candidateLastReadAt;
          return this.prisma.message.count({
            where: {
              conversationId: c.id,
              senderId: { not: user.id },
              ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
            },
          });
        }),
      ),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const companyById = new Map(employers.map((e) => [e.userId, e.companyName]));
    const seekerById = new Map(seekers.map((s) => [s.userId, s]));

    return convos.map((c, i) => {
      const viewerIsEmployer = isEmployerSideOf(c.employerId);
      const peerId = viewerIsEmployer ? c.candidateId : c.employerId;
      let name: string;
      let role: string;
      if (viewerIsEmployer) {
        const u = userById.get(peerId);
        name = u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Candidate';
        const s = seekerById.get(peerId);
        role = s?.currentTitle?.trim() || s?.headline?.trim() || 'Candidate';
      } else {
        name = companyById.get(peerId)?.trim() || 'Employer';
        role = 'Employer';
      }
      return {
        id: c.id,
        name,
        initials: this.initials(name),
        role,
        /**
         * The other participant's user id.
         *
         * Needed for anything that acts on the person rather than the thread —
         * opening their profile, proposing an interview. It was computed here
         * already and simply not returned, which left those actions unable to
         * name who they were about.
         */
        peerId,
        /** Which side the viewer is on, so the UI knows what the peer is. */
        viewerIsEmployer,
        lastMsg: c.messages[0]?.body ?? '',
        time: this.relTime(c.lastMessageAt ?? c.createdAt),
        unread: unreads[i],
        online: false, // presence is resolved client-side via Supabase Realtime
      };
    });
  }

  /** Messages in a conversation (participant-gated), oldest→newest. */
  async getMessages(user: User, conversationId: string, before?: string) {
    const convo = await this.requireParticipant(user, conversationId);
    const beforeDate = before ? new Date(before) : null;

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    rows.reverse();

    const peerLastRead = (await this.isEmployerSide(user, convo.employerId))
      ? convo.candidateLastReadAt
      : convo.employerLastReadAt;
    return Promise.all(
      rows.map(async (m) => {
        const mine = m.senderId === user.id;
        const seen = mine && peerLastRead != null && peerLastRead >= m.createdAt;
        return {
          id: m.id,
          conversationId: m.conversationId,
          from: mine ? 'me' : 'them',
          text: m.body,
          time: this.fmtTime(m.createdAt),
          date: this.fmtDate(m.createdAt),
          status: mine ? (seen ? 'seen' : 'delivered') : 'seen',
          attachments: await this.signAttachments(m.attachments),
        };
      }),
    );
  }

  /** Uploads a message attachment to the private bucket; the path is scoped to the conversation. */
  async uploadAttachment(user: User, conversationId: string, file: Express.Multer.File) {
    await this.requireParticipant(user, conversationId);
    if (!file?.buffer?.length) throw new BadRequestException('No file received.');
    const safe = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const path = `messages/${conversationId}/${randomUUID()}-${safe}`;
    await this.storage.uploadPrivateFile(path, file.buffer, file.mimetype, MESSAGE_ATTACHMENT_BUCKET);
    return { name: file.originalname, type: file.mimetype, size: this.humanSize(file.size), path };
  }

  /** Employer starts (or reopens) a thread with a candidate who applied to their company's job. */
  async startConversation(employer: User, dto: StartConversationDto) {
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    const application = await this.prisma.application.findFirst({
      // The consent that licenses this contact is the application to the
      // company, not to one recruiter — otherwise a colleague picking up the
      // thread is refused for a candidate who did apply here.
      where: { applicantId: dto.candidateId, job: { postedById: { in: memberIds } } },
      orderBy: { appliedAt: 'desc' },
      select: { jobId: true },
    });
    if (!application) {
      throw new ForbiddenException(
        "You can only message candidates who applied to one of your company's jobs.",
      );
    }

    // Reuse a colleague's existing thread with this candidate rather than
    // opening a second one. The unique key is (employerId, candidateId), so
    // without this the candidate would receive two parallel conversations from
    // the same company and neither recruiter would see the other's messages.
    const existing = await this.prisma.conversation.findFirst({
      where: { candidateId: dto.candidateId, employerId: { in: memberIds } },
      select: { id: true },
    });
    if (existing) return { id: existing.id };

    const convo = await this.prisma.conversation.upsert({
      where: { employerId_candidateId: { employerId: employer.id, candidateId: dto.candidateId } },
      create: { employerId: employer.id, candidateId: dto.candidateId, jobId: dto.jobId ?? application.jobId },
      update: {},
    });
    return { id: convo.id };
  }

  /** Sends a message; bumps the thread, marks the sender caught-up, notifies the recipient. */
  async sendMessage(user: User, conversationId: string, dto: SendMessageDto) {
    const convo = await this.requireParticipant(user, conversationId);
    const viewerIsEmployer = await this.isEmployerSide(user, convo.employerId);

    const body = (dto.body ?? '').trim();
    const attachments = dto.attachments ?? [];
    if (!body && attachments.length === 0) {
      throw new BadRequestException('Message is empty.');
    }
    // Each attachment path must belong to THIS conversation (uploaded via our endpoint).
    const prefix = `messages/${conversationId}/`;
    if (attachments.some((a) => !a.path.startsWith(prefix))) {
      throw new BadRequestException('Invalid attachment.');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
        attachments: attachments.length
          ? (attachments.map((a) => ({ name: a.name, type: a.type, size: a.size, path: a.path })) as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const now = new Date();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        ...(viewerIsEmployer ? { employerLastReadAt: now } : { candidateLastReadAt: now }),
      },
    });

    const recipientId = viewerIsEmployer ? convo.candidateId : convo.employerId;
    const senderName = await this.displayName(user.id, viewerIsEmployer);
    await this.notifications.create({
      userId: recipientId,
      type: 'message',
      title: `New message from ${senderName}`,
      message: body ? body.slice(0, 140) : `📎 ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`,
      // Deep-link each recipient to their own inbox.
      link: viewerIsEmployer ? '/jobseeker/messages' : '/employers/messages',
    });

    return {
      id: message.id,
      conversationId,
      from: 'me',
      text: message.body,
      time: this.fmtTime(message.createdAt),
      date: this.fmtDate(message.createdAt),
      status: 'delivered',
      attachments: await this.signAttachments(message.attachments),
    };
  }

  /** Marks the conversation read up to now for the requesting participant. */
  async markRead(user: User, conversationId: string) {
    const convo = await this.requireParticipant(user, conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: (await this.isEmployerSide(user, convo.employerId))
        ? { employerLastReadAt: new Date() }
        : { candidateLastReadAt: new Date() },
    });
    return { ok: true };
  }

  /* -------------------------------- helpers ------------------------------- */

  private async requireParticipant(user: User, conversationId: string): Promise<ConversationRow> {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.candidateId === user.id) return convo;
    // Colleagues count as the employer side, or a thread would be visible in
    // the shared inbox and then refused on open.
    if (await this.isEmployerSide(user, convo.employerId)) return convo;
    throw new ForbiddenException('You are not a participant in this conversation');
  }

  /**
   * Whether the caller acts for the employer in this thread.
   *
   * Not just `employerId === user.id`: the inbox is company-wide, so the
   * employer side of a thread may have been opened by a colleague. Getting this
   * wrong renders a teammate's thread as though the viewer were the candidate.
   */
  private async isEmployerSide(user: User, employerId: string): Promise<boolean> {
    if (employerId === user.id) return true;
    return (await this.companyContext.memberUserIds(user.id)).includes(employerId);
  }

  /** Turns stored attachment paths into short-lived signed download URLs. */
  private async signAttachments(raw: Prisma.JsonValue): Promise<
    { name: string; type: string; size: string; url?: string }[] | undefined
  > {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const atts = raw as unknown as StoredAttachment[];
    return Promise.all(
      atts.map(async (a) => ({
        name: a.name,
        type: a.type,
        size: a.size,
        url: a.path
          ? await this.storage.createSignedUrl(a.path, MESSAGE_ATTACHMENT_BUCKET, 3600).catch(() => undefined)
          : undefined,
      })),
    );
  }

  private humanSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  private async displayName(userId: string, isEmployer: boolean): Promise<string> {
    if (isEmployer) {
      const emp = await this.prisma.employerProfile.findUnique({ where: { userId }, select: { companyName: true } });
      return emp?.companyName?.trim() || 'An employer';
    }
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true },
    });
    return u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'A candidate';
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';
  }

  private relTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private fmtTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  private fmtDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
