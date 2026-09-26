import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from './company-context.service';
import { isFurtherAlong, ladderIndex, stageFromApplicationStatus } from '../common/pipeline-stage';

/**
 * Where the two pipelines meet.
 *
 * A company could source someone and then receive an application from them, and
 * the two records knew nothing about each other: two cards on two boards, two
 * stages, no way to tell which was current. This links them at the moment the
 * second one appears, whichever order that happens in.
 *
 * Lives beside company scoping for the same reason CandidateWatchersService
 * does — applications and shortlists are in different modules and both need
 * this, and a link made on only one side is not a link.
 *
 * Nothing here throws. An application must not fail to save because a sourcing
 * record could not be tidied up, and a shortlist add must not fail because an
 * application lookup did.
 */
@Injectable()
export class PipelineLinkService {
  private readonly logger = new Logger(PipelineLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Called when an application arrives: attach it to this company's sourcing
   * record for the same person, if there is one.
   *
   * `postedById` is the job's owner, which is how we find the company — the
   * applicant has no company of their own.
   */
  async linkOnApply(applicationId: string, candidateId: string, postedById: string): Promise<void> {
    try {
      const memberIds = await this.companyContext.memberUserIds(postedById);
      const items = await this.prisma.shortlistItem.findMany({
        where: {
          candidateId,
          applicationId: null,
          shortlist: { employerId: { in: memberIds } },
        },
        select: { id: true, stage: true, updatedAt: true },
      });
      if (items.length === 0) return;

      /**
       * One person can sit on several shortlists, because a shortlist is a saved
       * search rather than a named project. Only one can hold the link, since an
       * application belongs to one sourcing record — so the link goes to the
       * card furthest along, falling back to the most recently touched.
       *
       * Every matching card is still moved to at least APPLIED, so none of them
       * is left claiming this person has not applied.
       */
      const ranked = [...items].sort((a, b) => {
        const byStage = ladderIndex(b.stage) - ladderIndex(a.stage);
        return byStage !== 0 ? byStage : b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      const owner = ranked[0];

      await this.prisma.shortlistItem.update({
        where: { id: owner.id },
        data: { applicationId },
      });

      const behind = items.filter((i) => isFurtherAlong(PipelineStage.APPLIED, i.stage));
      if (behind.length > 0) {
        await this.prisma.shortlistItem.updateMany({
          where: { id: { in: behind.map((i) => i.id) } },
          data: { stage: PipelineStage.APPLIED },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Could not link application ${applicationId} to a shortlist: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Called when an application's status changes: move the sourced card with it.
   *
   * The mirror of ShortlistService's sync in the other direction. Both exist
   * because a recruiter moves a candidate from whichever board they happen to be
   * looking at, and only one of them updating is how the boards drifted apart.
   *
   * Unconditional rather than "only if further along": a rejection or a move
   * back down the ladder is exactly the kind of correction that has to travel.
   */
  async syncSourcedCard(applicationId: string, status: string): Promise<void> {
    try {
      const stage = stageFromApplicationStatus(status);
      // updateMany, not update: there may be no linked card, and that is normal
      // rather than an error to catch.
      await this.prisma.shortlistItem.updateMany({ where: { applicationId }, data: { stage } });
    } catch (err) {
      this.logger.warn(
        `Could not sync the sourced card for application ${applicationId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Called when someone is shortlisted: attach an application they already have
   * with this company, and adopt its stage if it is further along.
   *
   * The other order of events. A recruiter searching for candidates can easily
   * find someone who applied last week, and the card should not open at
   * "Sourced" when the company is already interviewing them.
   */
  async linkOnShortlist(
    shortlistItemId: string,
    candidateId: string,
    employerId: string,
  ): Promise<{ stage: PipelineStage; applicationId: string } | null> {
    try {
      const memberIds = await this.companyContext.memberUserIds(employerId);
      const application = await this.prisma.application.findFirst({
        where: {
          applicantId: candidateId,
          job: { postedById: { in: memberIds } },
          // Already spoken for: an application links to one sourcing record.
          shortlistItem: null,
        },
        select: { id: true, status: true },
        orderBy: { appliedAt: 'desc' },
      });
      if (!application) return null;

      const stage = stageFromApplicationStatus(application.status);
      await this.prisma.shortlistItem.update({
        where: { id: shortlistItemId },
        data: { applicationId: application.id },
      });
      return { stage, applicationId: application.id };
    } catch (err) {
      this.logger.warn(
        `Could not link shortlist item ${shortlistItemId} to an application: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

}
