import { ForbiddenException, Injectable } from '@nestjs/common';
import { CandidateReactionValue } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';
import { displayName } from '../company/company-audit.service';

/** How many names the UI will show before it summarises. */
const NAMES_SHOWN = 8;

/**
 * Thumbs up or down on a candidate, for triage.
 *
 * A hiring manager working through twenty cards can say "this one" and "not this
 * one" far faster than they can write a sentence, and a recruiter can read the
 * shape of the team's opinion at a glance. That is the whole job: it is not a
 * substitute for a note, and nothing is computed from it.
 *
 * **Deliberately not notified.** Notes and stage moves tell the people working a
 * candidate, because each is a considered act. A reaction is one click, and ten
 * of them arriving as ten notifications is precisely how a bell gets muted —
 * the same reasoning that keeps bulk stage moves silent. The count is visible
 * where the triage happens, which is where it is useful.
 *
 * **Never a score.** Reactions are reported as counts and names, never summed
 * into a rating or fed into ranking. Who thought what is the useful part; an
 * average would launder it into something that looks like a measurement.
 */
@Injectable()
export class CandidateReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Sets, changes or clears this person's reaction.
   *
   * `null` clears it. One row per person per candidate, so reacting again
   * replaces rather than accumulates — it is a current opinion, not a history of
   * what someone once thought.
   */
  async set(user: User, candidateId: string, value: CandidateReactionValue | null) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertReachable(context.memberUserIds, candidateId);

    if (value === null) {
      // deleteMany, not delete: clearing a reaction nobody gave is a no-op
      // rather than an error.
      await this.prisma.candidateReaction.deleteMany({
        where: { companyId: context.companyId, candidateId, userId: user.id },
      });
    } else {
      await this.prisma.candidateReaction.upsert({
        where: {
          companyId_candidateId_userId: {
            companyId: context.companyId,
            candidateId,
            userId: user.id,
          },
        },
        create: { companyId: context.companyId, candidateId, userId: user.id, value },
        update: { value },
      });
    }

    return this.forCandidate(user, candidateId);
  }

  /** The team's reactions to one candidate, and this caller's own. */
  async forCandidate(user: User, candidateId: string) {
    const context = await this.companyContext.requireForUser(user.id);
    await this.assertReachable(context.memberUserIds, candidateId);

    const rows = await this.prisma.candidateReaction.findMany({
      where: { companyId: context.companyId, candidateId },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, firstName: true, lastName: true, email: true } },
      },
    });

    return this.shape(rows, user.id);
  }

  /**
   * Reactions for a page of candidates at once.
   *
   * One query for the whole board rather than one per card — the counts are
   * meant to be glanceable, and twenty requests to render twenty badges is not
   * glanceable.
   */
  async forCandidates(companyId: string, candidateIds: string[], viewerId: string) {
    const ids = [...new Set(candidateIds)];
    if (ids.length === 0) return {};

    const rows = await this.prisma.candidateReaction.findMany({
      where: { companyId, candidateId: { in: ids } },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, firstName: true, lastName: true, email: true } },
      },
    });

    const byCandidate = new Map<string, typeof rows>();
    for (const r of rows) {
      byCandidate.set(r.candidateId, [...(byCandidate.get(r.candidateId) ?? []), r]);
    }

    const out: Record<string, ReturnType<CandidateReactionsService['shape']>> = {};
    for (const [candidateId, list] of byCandidate) {
      out[candidateId] = this.shape(list, viewerId);
    }
    return out;
  }

  private shape(
    rows: Array<{
      value: CandidateReactionValue;
      userId: string;
      user: { id: string; displayName: string | null; firstName: string | null; lastName: string | null; email: string };
    }>,
    viewerId: string,
  ) {
    const up = rows.filter((r) => r.value === CandidateReactionValue.UP);
    const down = rows.filter((r) => r.value === CandidateReactionValue.DOWN);
    const name = (r: (typeof rows)[number]) => displayName(r.user);

    return {
      up: up.length,
      down: down.length,
      /**
       * Who thought what. A bare count invites "4 up, 1 down" being read as a
       * verdict; knowing the one down was the engineer who ran the technical
       * round is the part that actually helps.
       */
      upBy: up.slice(0, NAMES_SHOWN).map(name),
      downBy: down.slice(0, NAMES_SHOWN).map(name),
      /** So the UI can show the caller's own reaction as chosen. */
      mine: rows.find((r) => r.userId === viewerId)?.value ?? null,
    };
  }

  /**
   * The same rule notes and tags use: only people this company is actually
   * working with, so a reaction cannot be attached to a stranger.
   */
  private async assertReachable(memberUserIds: string[], candidateId: string) {
    const applied = await this.prisma.application.findFirst({
      where: { applicantId: candidateId, job: { postedById: { in: memberUserIds } } },
      select: { id: true },
    });
    if (applied) return;

    const shortlisted = await this.prisma.shortlistItem.findFirst({
      where: { candidateId, shortlist: { employerId: { in: memberUserIds } } },
      select: { id: true },
    });
    if (shortlisted) return;

    throw new ForbiddenException(
      'You can only react to candidates who have applied to your company or been added to a project.',
    );
  }
}
