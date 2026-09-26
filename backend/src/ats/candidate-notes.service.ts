import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CandidateWatchersService } from '../company/candidate-watchers.service';
import { User } from '../common/types/user.types';
import { stageInsteadOfTag } from '../common/pipeline-stage';

function displayName(user: User): string {
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email
  );
}

/**
 * Notes and tags a company keeps about a candidate.
 *
 * Both are the company's private working memory. Neither is ever returned on
 * any candidate-facing route: someone should not discover how they were
 * labelled by reading their own profile, and a recruiter who thinks a note
 * might be read writes a less useful note.
 */
/** The start of a note, for a notification that has to fit one. */
function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + String.fromCharCode(8230) : flat;
}

@Injectable()
export class CandidateNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly watchers: CandidateWatchersService,
  ) {}

  /**
   * Notes about a candidate, newest first.
   *
   * Scoped to the caller's company, so two companies looking at the same person
   * see only their own. Following the person rather than one application is the
   * point: an assessment written in March is still worth reading in July.
   */
  async list(user: User, candidateId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertCandidateReachable(context.memberUserIds, candidateId);

    const notes = await this.prisma.candidateNote.findMany({
      where: { companyId: context.companyId, candidateId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.authorId,
      authorName: n.authorName,
      createdAt: n.createdAt,
      /** So the UI can offer edit/delete only where they will be allowed. */
      mine: n.authorId === user.id,
    }));
  }

  async create(user: User, candidateId: string, body: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertCandidateReachable(context.memberUserIds, candidateId);

    const note = await this.prisma.candidateNote.create({
      data: {
        companyId: context.companyId,
        candidateId,
        authorId: user.id,
        // Copied rather than joined: the note stays attributable after the
        // author's account is deleted, when authorId becomes null.
        authorName: displayName(user),
        body: body.trim(),
      },
    });

    // The feedback loop: a manager's comment is only worth writing if the
    // recruiter learns it was written. Not awaited — the note is saved either way.
    void this.announce(user, context, candidateId, {
      title: (who, whom) => `${who} left a note on ${whom}`,
      message: excerpt(body),
    });

    return { id: note.id, createdAt: note.createdAt };
  }

  /**
   * Only the author may change or remove a note.
   *
   * A shared inbox is right for messages and wrong for opinions: editing a
   * colleague's assessment would leave their name on words they did not write.
   */
  async update(user: User, noteId: string, body: string) {
    const note = await this.requireOwnNote(user, noteId);
    await this.prisma.candidateNote.update({
      where: { id: note.id },
      data: { body: body.trim() },
    });
    return { id: note.id };
  }

  async remove(user: User, noteId: string) {
    const note = await this.requireOwnNote(user, noteId);
    await this.prisma.candidateNote.delete({ where: { id: note.id } });
    return { id: note.id };
  }

  /* ---------------------------------- tags --------------------------------- */

  async listTags(user: User, candidateId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertCandidateReachable(context.memberUserIds, candidateId);
    const tags = await this.prisma.candidateTag.findMany({
      where: { companyId: context.companyId, candidateId },
      orderBy: { label: 'asc' },
      select: { id: true, label: true },
    });
    return tags;
  }

  async addTag(user: User, candidateId: string, label: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertCandidateReachable(context.memberUserIds, candidateId);
    const clean = label.trim().slice(0, 40);
    if (!clean) throw new BadRequestException('A tag needs a label.');
    // Status belongs in the stage; a tag that repeats one would contradict it.
    const stageInstead = stageInsteadOfTag(clean);
    if (stageInstead) throw new BadRequestException(stageInstead);

    // Checked first so a repeat is not announced: confirming a tag that is
    // already there changes nothing anyone needs to hear about.
    const already = await this.prisma.candidateTag.findUnique({
      where: {
        companyId_candidateId_label: { companyId: context.companyId, candidateId, label: clean },
      },
      select: { id: true },
    });

    // Idempotent: adding a tag that is already there is not an error, it is
    // someone confirming what they wanted.
    const tag = await this.prisma.candidateTag.upsert({
      where: {
        companyId_candidateId_label: {
          companyId: context.companyId,
          candidateId,
          label: clean,
        },
      },
      create: {
        companyId: context.companyId,
        candidateId,
        label: clean,
        createdById: user.id,
      },
      update: {},
      select: { id: true, label: true },
    });

    if (!already) {
      void this.announce(user, context, candidateId, {
        title: (who, whom) => `${who} tagged ${whom}`,
        message: `"${clean}"`,
      });
    }
    return tag;
  }

  async removeTag(user: User, tagId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const tag = await this.prisma.candidateTag.findUnique({ where: { id: tagId } });
    if (!tag || tag.companyId !== context.companyId) {
      throw new NotFoundException('Tag not found');
    }
    await this.prisma.candidateTag.delete({ where: { id: tagId } });
    return { id: tagId };
  }

  /** Every label this company has used, for autocomplete. */
  async labelsInUse(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    const rows = await this.prisma.candidateTag.groupBy({
      by: ['label'],
      where: { companyId: context.companyId },
      _count: { label: true },
      orderBy: { _count: { label: 'desc' } },
      take: 50,
    });
    return rows.map((r) => ({ label: r.label, count: r._count.label }));
  }

  /* -------------------------------- helpers -------------------------------- */

  private async announce(
    user: User,
    context: { companyId: string; memberUserIds: string[] },
    candidateId: string,
    note: { title: (who: string, whom: string) => string; message: string },
  ) {
    const [whom, link] = await Promise.all([
      this.watchers.nameOf(candidateId),
      this.watchers.linkFor(context.memberUserIds, candidateId),
    ]);
    await this.watchers.tell(
      {
        companyId: context.companyId,
        memberUserIds: context.memberUserIds,
        candidateId,
        actorId: user.id,
      },
      { title: note.title(displayName(user), whom), message: note.message, link },
    );
  }

  /**
   * A company may only annotate someone who actually reached them.
   *
   * Without this, any employer could accumulate a private dossier on any user
   * on the platform by posting note after note against ids they never met.
   */
  private async assertCandidateReachable(
    memberUserIds: string[],
    candidateId: string,
  ): Promise<void> {
    const applied = await this.prisma.application.findFirst({
      where: { applicantId: candidateId, job: { postedById: { in: memberUserIds } } },
      select: { id: true },
    });
    if (applied) return;

    // Sourced candidates count too — a shortlist is how someone enters the
    // pipeline before they have applied to anything.
    const shortlisted = await this.prisma.shortlistItem.findFirst({
      where: { candidateId, shortlist: { employerId: { in: memberUserIds } } },
      select: { id: true },
    });
    if (shortlisted) return;

    throw new ForbiddenException(
      'You can only annotate candidates who have applied to your company or been added to a shortlist.',
    );
  }

  private async requireOwnNote(user: User, noteId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const note = await this.prisma.candidateNote.findUnique({ where: { id: noteId } });
    if (!note || note.companyId !== context.companyId) {
      throw new NotFoundException('Note not found');
    }
    if (note.authorId !== user.id) {
      throw new ForbiddenException('You can only edit notes you wrote.');
    }
    return note;
  }
}
