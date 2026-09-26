import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PipelineStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CandidateWatchersService } from '../company/candidate-watchers.service';
import { PipelineLinkService } from '../company/pipeline-link.service';
import { User } from '../common/types/user.types';
import { PIPELINE_STAGE_LABELS, isFurtherAlong, statusForStage } from '../common/pipeline-stage';
import { OpenShortlistDto, UpsertShortlistItemDto } from './dto/shortlist.dto';

@Injectable()
export class ShortlistService {
  private readonly logger = new Logger(ShortlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly watchers: CandidateWatchersService,
    private readonly pipelineLink: PipelineLinkService,
  ) {}

  /** Stable key for a prompt — lets a long query be uniquely indexed. */
  private keyFor(query: string): string {
    return createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
  }

  /** Gets (or creates) the shortlist for this company + search, with its items. */
  async open(employer: User, dto: OpenShortlistDto) {
    const queryKey = this.keyFor(dto.query);

    // Reuse a colleague's shortlist for the same search rather than starting a
    // private copy. Without this, reopening a teammate's session would fork the
    // pipeline in two and neither person would see the other's progress.
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    const shared = await this.prisma.shortlist.findFirst({
      where: { queryKey, employerId: { in: memberIds } },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    if (shared) {
      const touched = await this.prisma.shortlist.update({
        where: { id: shared.id },
        data: {
          ...(dto.roleTitle ? { roleTitle: dto.roleTitle } : {}),
          lastOpenedAt: new Date(),
        },
        include: { items: { orderBy: { addedAt: 'asc' } } },
      });
      return this.shape(touched);
    }

    const shortlist = await this.prisma.shortlist.upsert({
      where: { employerId_queryKey: { employerId: employer.id, queryKey } },
      create: {
        employerId: employer.id,
        queryKey,
        query: dto.query,
        roleTitle: dto.roleTitle ?? null,
        lastOpenedAt: new Date(),
      },
      update: {
        ...(dto.roleTitle ? { roleTitle: dto.roleTitle } : {}),
        lastOpenedAt: new Date(),
      },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    return this.shape(shortlist);
  }

  /**
   * Upserts one item — covers add-to-pipeline, stage moves, and save/unsave.
   * An item that is neither saved nor in a stage is removed entirely.
   */
  async upsertItem(employer: User, shortlistId: string, candidateId: string, dto: UpsertShortlistItemDto) {
    const shortlist = await this.requireOwned(employer, shortlistId);
    const existing = await this.prisma.shortlistItem.findUnique({
      where: { shortlistId_candidateId: { shortlistId, candidateId } },
    });

    const stage = dto.stage === undefined ? (existing?.stage ?? null) : dto.stage;
    const saved = dto.saved === undefined ? (existing?.saved ?? false) : dto.saved;

    // No longer saved and not in the pipeline → drop it.
    if (!saved && stage === null) {
      if (existing) {
        await this.prisma.shortlistItem.delete({ where: { id: existing.id } });
        await this.touch(shortlistId);
      }
      return { removed: true, candidateId };
    }

    if (!existing && !dto.snapshot) {
      throw new BadRequestException('A candidate snapshot is required when shortlisting for the first time.');
    }

    let item = await this.prisma.shortlistItem.upsert({
      where: { shortlistId_candidateId: { shortlistId, candidateId } },
      create: {
        shortlistId,
        candidateId,
        stage,
        saved,
        snapshot: (dto.snapshot ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        stage,
        saved,
        ...(dto.snapshot ? { snapshot: dto.snapshot as Prisma.InputJsonValue } : {}),
      },
    });
    await this.touch(shortlistId);

    /**
     * Newly shortlisted, and they may already have applied here.
     *
     * A recruiter searching the talent pool can easily turn up someone who
     * applied last week. Opening their card at "Sourced" while the company is
     * already interviewing them is how the two boards used to contradict each
     * other, so the card adopts the application's stage when it is further
     * along, and the two records are linked from here on.
     */
    let adoptedFromApplication = false;
    if (!existing) {
      const linked = await this.pipelineLink.linkOnShortlist(item.id, candidateId, employer.id);
      if (linked) {
        if (isFurtherAlong(linked.stage, item.stage)) {
          item = await this.prisma.shortlistItem.update({
            where: { id: item.id },
            data: { stage: linked.stage },
          });
          adoptedFromApplication = true;
        } else {
          item = { ...item, applicationId: linked.applicationId };
        }
      }
    }

    /**
     * Keep a linked application in step.
     *
     * While a sourcing record is linked to an application, the two describe one
     * person. Moving the sourced card without moving the application is how the
     * boards used to disagree — one saying Interview, the other Screening, with
     * no way to tell which was right.
     */
    /**
     * An adopted stage is not a move.
     *
     * When the card catches up with an application the team already has, nobody
     * moved this candidate — so there is nothing to announce ("Ada moved Sam to
     * Interview" would name a move Ada did not make) and nothing to write back
     * to an application that is already there.
     */
    if (!adoptedFromApplication && stage !== null && stage !== (existing?.stage ?? null)) {
      await this.syncLinkedApplication(item.applicationId, stage);
      // A stage change is worth telling the people working this candidate;
      // saving or unsaving is someone's own bookmark and is nobody else's news.
      void this.announceMove(employer, candidateId, stage);
    }
    void shortlist;
    return this.shapeItem(item);
  }

  /**
   * Moves a sourced candidate by their card's id, for the merged board.
   *
   * That board lists people from every saved search at once, so it knows a
   * card's id but not which search produced it. Everything else matches
   * `upsertItem`: the move reaches a linked application, and the people working
   * this candidate are told.
   */
  async moveItemById(employer: User, itemId: string, stage: PipelineStage) {
    const item = await this.prisma.shortlistItem.findUnique({
      where: { id: itemId },
      include: { shortlist: { select: { id: true, employerId: true } } },
    });
    // 404 rather than 403 for a card belonging to another company, so the board
    // cannot be used to discover that someone else is working a candidate.
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    if (!item || !memberIds.includes(item.shortlist.employerId)) {
      throw new NotFoundException('Candidate not found');
    }
    if (item.stage === stage) return this.shapeItem(item);

    const updated = await this.prisma.shortlistItem.update({
      where: { id: itemId },
      data: { stage },
    });
    await this.touch(item.shortlist.id);
    await this.syncLinkedApplication(item.applicationId, stage);
    void this.announceMove(employer, item.candidateId, stage);
    return this.shapeItem(updated);
  }

  /**
   * The project a search already feeds, if any. Creates nothing.
   *
   * Running a search used to create a container there and then, so this
   * database filled with empty ones — "frontend dev", "frontend developer",
   * "frontend developer with 2 years of experience in", none of them holding
   * anybody. A project should come into existence when there is somebody to put
   * in it, so looking is now a read and the first add is what creates.
   */
  async find(employer: User, query: string) {
    const trimmed = query?.trim();
    if (!trimmed) return null;

    const memberIds = await this.companyContext.memberUserIds(employer.id);
    const found = await this.prisma.shortlist.findFirst({
      where: { queryKey: this.keyFor(trimmed), employerId: { in: memberIds } },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    return found ? this.shape(found) : null;
  }

  /**
   * Creates a project with a name and no search behind it.
   *
   * The point of the whole change: a project you mean to keep should not have
   * to begin as a search you happened to run.
   */
  async createProject(employer: User, name: string) {
    const clean = name.trim();
    if (!clean) throw new BadRequestException('A project needs a name.');

    const project = await this.prisma.shortlist.create({
      data: {
        employerId: employer.id,
        name: clean,
        // No query and no key: this one was made deliberately, not found.
        queryKey: null,
        query: null,
        lastOpenedAt: new Date(),
      },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    return this.shape(project);
  }

  /**
   * Moves a candidate's card into another project.
   *
   * The consolidation this exists for: three searches for one job leave people
   * scattered across three containers, and until now there was no way to gather
   * them without losing their stage and starting again.
   *
   * If the target already holds that candidate the two are **merged** rather
   * than refused — the card keeps whichever stage is further along, and any
   * link to an application survives. Refusing would leave the recruiter to
   * work out which of two cards to delete.
   */
  async moveItemToProject(employer: User, itemId: string, targetShortlistId: string) {
    const memberIds = await this.companyContext.memberUserIds(employer.id);

    const [item, target] = await Promise.all([
      this.prisma.shortlistItem.findUnique({
        where: { id: itemId },
        include: { shortlist: { select: { id: true, employerId: true } } },
      }),
      this.prisma.shortlist.findUnique({ where: { id: targetShortlistId } }),
    ]);

    // 404 for anything outside the company, so this cannot be used to discover
    // that someone else is working a candidate.
    if (!item || !memberIds.includes(item.shortlist.employerId)) {
      throw new NotFoundException('Candidate not found');
    }
    if (!target || !memberIds.includes(target.employerId)) {
      throw new NotFoundException('Project not found');
    }
    if (item.shortlist.id === target.id) return this.shapeItem(item);

    const existing = await this.prisma.shortlistItem.findUnique({
      where: { shortlistId_candidateId: { shortlistId: target.id, candidateId: item.candidateId } },
    });

    const moved = await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        return tx.shortlistItem.update({
          where: { id: item.id },
          data: { shortlistId: target.id },
        });
      }

      /**
       * Already there. Keep the better of the two rather than either blindly:
       * the further stage, the link if either has one, and saved if either was.
       * Then drop the card being moved, so one person is one card again.
       */
      const keepStage = isFurtherAlong(item.stage ?? PipelineStage.SOURCED, existing.stage)
        ? item.stage
        : existing.stage;

      const merged = await tx.shortlistItem.update({
        where: { id: existing.id },
        data: {
          stage: keepStage,
          saved: existing.saved || item.saved,
          applicationId: existing.applicationId ?? item.applicationId,
          // The newer snapshot is the more recent view of this person.
          snapshot: item.snapshot as Prisma.InputJsonValue,
        },
      });
      await tx.shortlistItem.delete({ where: { id: item.id } });
      return merged;
    });

    await Promise.all([this.touch(item.shortlist.id), this.touch(target.id)]);
    return this.shapeItem(moved);
  }

  /**
   * Writes a sourced-board move through to the application behind it.
   *
   * Only for stages an application can actually be in: moving someone back to
   * SOURCED or CONTACTED describes the approach, not the application, and there
   * is no status that means "un-applied". Never throws — the card moved, and a
   * failure here must not present that as a failed move.
   */
  private async syncLinkedApplication(applicationId: string | null, stage: PipelineStage) {
    if (!applicationId) return;
    const status = statusForStage(stage);
    if (!status) return;
    try {
      await this.prisma.application.update({ where: { id: applicationId }, data: { status } });
    } catch (err) {
      this.logger.warn(
        `Could not sync application ${applicationId} to ${stage}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async announceMove(actor: User, candidateId: string, stage: PipelineStage) {
    const context = await this.companyContext.forUser(actor.id);
    if (!context) return;
    const [who, whom] = await Promise.all([
      this.watchers.nameOf(actor.id),
      this.watchers.nameOf(candidateId),
    ]);
    await this.watchers.tell(
      {
        companyId: context.companyId,
        memberUserIds: context.memberUserIds,
        candidateId,
        actorId: actor.id,
      },
      {
        title: `${who} moved ${whom}`,
        // The label, not the enum name: "Now at SOURCED." reads like a leak.
        message: `Now at ${PIPELINE_STAGE_LABELS[stage]}.`,
        link: await this.watchers.linkFor(context.memberUserIds, candidateId),
      },
    );
  }

  async removeItem(employer: User, shortlistId: string, candidateId: string) {
    await this.requireOwned(employer, shortlistId);
    await this.prisma.shortlistItem
      .delete({ where: { shortlistId_candidateId: { shortlistId, candidateId } } })
      .catch(() => undefined);
    await this.touch(shortlistId);
    return { removed: true, candidateId };
  }


  /**
   * Past sourcing sessions, pinned first then most recently opened.
   *
   * Counts rather than candidates: the rail needs to say how much work is in
   * each row, and shipping every snapshot for every row would be a large
   * payload nobody reads.
   */
  async list(employer: User) {
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    const rows = await this.prisma.shortlist.findMany({
      where: { employerId: { in: memberIds } },
      orderBy: [{ pinned: 'desc' }, { lastOpenedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 60,
      include: {
        items: { select: { stage: true, saved: true } },
      },
    });

    const owners = await this.prisma.user.findMany({
      where: { id: { in: Array.from(new Set(rows.map((r) => r.employerId))) } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    const ownerById = new Map(owners.map((o) => [o.id, o]));

    return rows.map((r) => {
      const o = ownerById.get(r.employerId);
      return {
        id: r.id,
        name: r.name,
        query: r.query,
        roleTitle: r.roleTitle,
        /** No search behind it: made deliberately, not found. */
        isProject: r.queryKey === null,
        pinned: r.pinned,
        candidateCount: r.items.length,
        inPipeline: r.items.filter((i) => i.stage !== null).length,
        lastOpenedAt: r.lastOpenedAt ?? r.updatedAt,
        updatedAt: r.updatedAt,
        // Shown because a shared list needs to say whose work a row is.
        createdBy:
          o?.displayName?.trim() ||
          [o?.firstName, o?.lastName].filter(Boolean).join(' ').trim() ||
          o?.email ||
          'A colleague',
        isMine: r.employerId === employer.id,
      };
    });
  }

  /** Reopens a stored session by id, and marks it as just looked at. */
  async getById(employer: User, shortlistId: string) {
    await this.requireOwned(employer, shortlistId);
    const shortlist = await this.prisma.shortlist.update({
      where: { id: shortlistId },
      data: { lastOpenedAt: new Date() },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    return this.shape(shortlist);
  }

  async update(
    employer: User,
    shortlistId: string,
    dto: { pinned?: boolean; roleTitle?: string; name?: string },
  ) {
    await this.requireOwned(employer, shortlistId);
    const shortlist = await this.prisma.shortlist.update({
      where: { id: shortlistId },
      data: {
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.roleTitle !== undefined ? { roleTitle: dto.roleTitle.trim() || null } : {}),
        // Clearing the name leaves a plain saved search behind rather than
        // an untitled project, which is what an empty box means here.
        ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
      },
      include: { items: { orderBy: { addedAt: 'asc' } } },
    });
    return this.shape(shortlist);
  }

  /** Deletes the session and its pipeline. Items cascade. */
  async remove(employer: User, shortlistId: string) {
    await this.requireOwned(employer, shortlistId);
    await this.prisma.shortlist.delete({ where: { id: shortlistId } });
    return { removed: true, id: shortlistId };
  }

  /* ------------------------------- helpers -------------------------------- */

  /**
   * Sourcing is company work, not private scratch.
   *
   * A colleague picking up a role needs the shortlist that was already built
   * for it, and the pipeline must not leave with the recruiter who built it.
   * Scoped to company members rather than the caller for the same reason jobs
   * and candidate threads are.
   */
  private async requireOwned(employer: User, shortlistId: string) {
    const shortlist = await this.prisma.shortlist.findUnique({ where: { id: shortlistId } });
    if (!shortlist) throw new NotFoundException('Shortlist not found');
    const memberIds = await this.companyContext.memberUserIds(employer.id);
    if (!memberIds.includes(shortlist.employerId)) {
      throw new NotFoundException('Shortlist not found');
    }
    return shortlist;
  }

  private touch(shortlistId: string) {
    return this.prisma.shortlist.update({ where: { id: shortlistId }, data: { updatedAt: new Date() } });
  }

  private shape(s: {
    id: string;
    name: string | null;
    query: string | null;
    roleTitle: string | null;
    items: {
      id: string;
      candidateId: string;
      stage: PipelineStage | null;
      applicationId: string | null;
      saved: boolean;
      snapshot: Prisma.JsonValue;
      addedAt: Date;
    }[];
  }) {
    return {
      id: s.id,
      name: s.name,
      query: s.query,
      roleTitle: s.roleTitle,
      items: s.items.map((i) => this.shapeItem(i)),
    };
  }

  private shapeItem(i: {
    id: string;
    candidateId: string;
    stage: PipelineStage | null;
    applicationId: string | null;
    saved: boolean;
    snapshot: Prisma.JsonValue;
    addedAt: Date;
  }) {
    return {
      /** The card itself, which is what moving between projects addresses. */
      id: i.id,
      candidateId: i.candidateId,
      stage: i.stage,
      /**
       * Sent so the card can say this person applied and link across to the
       * application, instead of appearing as a second, unrelated candidate.
       */
      applicationId: i.applicationId,
      saved: i.saved,
      snapshot: i.snapshot,
      addedAt: i.addedAt,
    };
  }
}
