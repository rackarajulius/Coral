import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Most people told about one change. A company is not a mailing list. */
const MAX_WATCHERS = 20;

/**
 * Who in a company should hear that something happened to a candidate.
 *
 * Not everyone. Telling the whole company every time a note is written is how a
 * notification bell becomes noise, and noise is how the ones that matter stop
 * being read. The people told are the ones already working this candidate:
 *
 *  - whoever posted a job they applied to;
 *  - whoever put them on a shortlist;
 *  - whoever has written a note about them.
 *
 * Never the person who did it — being told what you just did is noise too.
 */
@Injectable()
export class CandidateWatchersService {
  private readonly logger = new Logger(CandidateWatchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async watchers(params: {
    companyId: string;
    memberUserIds: string[];
    candidateId: string;
    actorId: string;
  }): Promise<string[]> {
    const { companyId, memberUserIds, candidateId, actorId } = params;

    const [applications, shortlists, notes] = await Promise.all([
      this.prisma.application.findMany({
        where: { applicantId: candidateId, job: { postedById: { in: memberUserIds } } },
        select: { job: { select: { postedById: true } } },
      }),
      this.prisma.shortlistItem.findMany({
        where: { candidateId, shortlist: { employerId: { in: memberUserIds } } },
        select: { shortlist: { select: { employerId: true } } },
      }),
      this.prisma.candidateNote.findMany({
        where: { companyId, candidateId, authorId: { not: null } },
        select: { authorId: true },
      }),
    ]);

    const ids = new Set<string>([
      ...applications.map((a) => a.job.postedById),
      ...shortlists.map((s) => s.shortlist.employerId),
      ...notes.map((n) => n.authorId!).filter(Boolean),
    ]);
    ids.delete(actorId);

    // Only people still in the company. Someone who has left must not keep
    // hearing about candidates they no longer have access to.
    return [...ids].filter((id) => memberUserIds.includes(id)).slice(0, MAX_WATCHERS);
  }

  /**
   * Tells the watchers.
   *
   * Never throws. A note or a stage change that succeeded must not be reported
   * as a failure because a notification did not go out.
   */
  async tell(
    params: { companyId: string; memberUserIds: string[]; candidateId: string; actorId: string },
    note: { title: string; message: string; link: string },
  ): Promise<void> {
    try {
      const to = await this.watchers(params);
      for (const userId of to) {
        await this.notifications.create({
          userId,
          type: 'candidate',
          title: note.title,
          message: note.message,
          link: note.link,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Candidate watcher notification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Where a notification about this candidate should land.
   *
   * Someone who applied lives on the candidates board; someone sourced lives in
   * the hiring workspace. Landing on the wrong one shows a list without them in
   * it, which reads as the notification being wrong.
   */
  async linkFor(memberUserIds: string[], candidateId: string): Promise<string> {
    const applied = await this.prisma.application.findFirst({
      where: { applicantId: candidateId, job: { postedById: { in: memberUserIds } } },
      select: { id: true },
    });
    return applied ? `/employers/candidates?candidate=${candidateId}` : '/employers/hiring';
  }

  /** How a person is named in a notification line. */
  async nameOf(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true, email: true },
    });
    return (
      u?.displayName?.trim() ||
      [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() ||
      u?.email ||
      'Someone'
    );
  }
}
