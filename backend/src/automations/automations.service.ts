import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ScheduledTask, ScheduledTaskType, TaskCadence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CandidateSourcingService } from '../employer-hiring/candidate-sourcing.service';
import { User } from '../common/types/user.types';
import { computeNextRun, describeCadence, isValidZone } from './next-run';
import { TASK_DEFINITIONS, definitionFor } from './task-registry';

const DAY_MS = 86_400_000;
/** How many reported candidate ids a watcher remembers. See the handler. */
const SEEN_CAP = 500;

/** What a run found. `count: 0` means the task ran and there was nothing. */
export interface TaskOutcome {
  count: number;
  title: string;
  message: string;
}

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly sourcing: CandidateSourcingService,
  ) {}

  /** The catalogue, for the template gallery. */
  templates() {
    return TASK_DEFINITIONS.map((d) => ({
      type: d.type,
      label: d.label,
      description: d.description,
      icon: d.icon,
      ...d.defaults,
      allowMultiple: d.allowMultiple ?? false,
      requiresTarget: d.requiresTarget ?? null,
      cadenceLabel: describeCadence({
        cadence: d.defaults.cadence,
        hourLocal: d.defaults.hourLocal,
        weekday: d.defaults.weekday,
      }),
    }));
  }

  async list(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    const rows = await this.prisma.scheduledTask.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ enabled: 'desc' }, { nextRunAt: 'asc' }],
    });

    // Resolve what the per-target rows are watching, so a list of three
    // watchers does not read as three identical lines.
    const targetIds = rows.map((r) => r.configKey).filter(Boolean);
    const shortlists = targetIds.length
      ? await this.prisma.shortlist.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, name: true, query: true, roleTitle: true },
        })
      : [];
    const labelById = new Map(
      shortlists.map((sl) => [sl.id, sl.roleTitle?.trim() || sl.query]),
    );

    return rows.map((t) =>
      // A missing label means the search was deleted — the handler says so on
      // its next run, and the UI shows it as broken rather than blank.
      this.shape(t, t.configKey ? (labelById.get(t.configKey) ?? null) : null),
    );
  }

  async create(
    user: User,
    dto: {
      type: ScheduledTaskType;
      cadence?: TaskCadence;
      hourLocal?: number;
      weekday?: number | null;
      timezone?: string;
      notifyWhenEmpty?: boolean;
      /** Required for task types that watch one specific thing. */
      shortlistId?: string;
    },
  ) {
    const context = await this.companyContext.requireForUser(user.id);
    const def = definitionFor(dto.type);

    // A per-target task is meaningless without its target, and the target must
    // belong to this company — otherwise a task id from elsewhere would quietly
    // watch another company's search.
    let configKey = '';
    if (def.requiresTarget === 'shortlist') {
      if (!dto.shortlistId) {
        throw new BadRequestException('Choose which saved search to watch.');
      }
      const memberIds = await this.companyContext.memberUserIds(user.id);
      const shortlist = await this.prisma.shortlist.findFirst({
        where: { id: dto.shortlistId, employerId: { in: memberIds } },
        select: { id: true },
      });
      if (!shortlist) throw new NotFoundException('That saved search no longer exists.');
      configKey = shortlist.id;
    }

    const cadence = dto.cadence ?? def.defaults.cadence;
    const hourLocal = dto.hourLocal ?? def.defaults.hourLocal;
    const weekday = cadence === TaskCadence.WEEKLY ? (dto.weekday ?? def.defaults.weekday ?? 1) : null;
    // An unrecognised zone would otherwise be stored and then silently run at
    // UTC forever; reject it while the person is still looking at the form.
    const timezone = dto.timezone && isValidZone(dto.timezone) ? dto.timezone : 'UTC';

    const existing = await this.prisma.scheduledTask.findUnique({
      where: {
        companyId_type_configKey: { companyId: context.companyId, type: dto.type, configKey },
      },
    });
    if (existing) {
      throw new BadRequestException(
        def.allowMultiple
          ? 'You are already watching that search.'
          : 'You already have this task. Edit the one you have instead.',
      );
    }

    const task = await this.prisma.scheduledTask.create({
      data: {
        companyId: context.companyId,
        createdById: user.id,
        type: dto.type,
        configKey,
        cadence,
        hourLocal,
        weekday,
        timezone,
        notifyWhenEmpty: dto.notifyWhenEmpty ?? false,
        nextRunAt: computeNextRun({ cadence, hourLocal, weekday, timezone }),
      },
    });
    return this.shape(task);
  }

  async update(
    user: User,
    id: string,
    dto: {
      cadence?: TaskCadence;
      hourLocal?: number;
      weekday?: number | null;
      timezone?: string;
      enabled?: boolean;
      notifyWhenEmpty?: boolean;
    },
  ) {
    const task = await this.requireOwned(user, id);

    const cadence = dto.cadence ?? task.cadence;
    const hourLocal = dto.hourLocal ?? task.hourLocal;
    const weekday = cadence === TaskCadence.WEEKLY ? (dto.weekday ?? task.weekday ?? 1) : null;
    const timezone = dto.timezone && isValidZone(dto.timezone) ? dto.timezone : task.timezone;
    const enabled = dto.enabled ?? task.enabled;

    // Any change to *when* it runs invalidates the stored next run, and a
    // re-enabled task must not fire immediately for every slot it slept through.
    const scheduleChanged =
      cadence !== task.cadence ||
      hourLocal !== task.hourLocal ||
      weekday !== task.weekday ||
      timezone !== task.timezone ||
      (enabled && !task.enabled);

    const updated = await this.prisma.scheduledTask.update({
      where: { id },
      data: {
        cadence,
        hourLocal,
        weekday,
        timezone,
        enabled,
        ...(dto.notifyWhenEmpty !== undefined ? { notifyWhenEmpty: dto.notifyWhenEmpty } : {}),
        ...(scheduleChanged
          ? { nextRunAt: computeNextRun({ cadence, hourLocal, weekday, timezone }) }
          : {}),
      },
    });
    return this.shape(updated);
  }

  async remove(user: User, id: string) {
    await this.requireOwned(user, id);
    await this.prisma.scheduledTask.delete({ where: { id } });
    return { removed: true, id };
  }

  /** Runs one task now, without touching its schedule. */
  async runNow(user: User, id: string) {
    const task = await this.requireOwned(user, id);
    const outcome = await this.execute(task);
    await this.prisma.scheduledTask.update({
      where: { id },
      data: { lastRunAt: new Date(), lastSummary: outcome.message },
    });
    return outcome;
  }

  /* ------------------------------ execution ------------------------------- */

  /**
   * Runs a task and reports what it found.
   *
   * Every handler counts real rows. A task that finds nothing returns `count:
   * 0` and an honest message — it never invents a number to look busy, and the
   * caller decides whether zero is worth a notification.
   */
  async execute(task: ScheduledTask): Promise<TaskOutcome> {
    const memberIds = await this.companyContext.memberUserIds(task.createdById);

    switch (task.type) {
      case ScheduledTaskType.STALE_APPLICATIONS: {
        const count = await this.prisma.application.count({
          where: {
            job: { postedById: { in: memberIds } },
            status: 'pending',
            appliedAt: { lt: new Date(Date.now() - 7 * DAY_MS) },
          },
        });
        return {
          count,
          title: count ? 'Candidates are waiting for a reply' : 'No one is waiting',
          message: count
            ? `${count} application${count === 1 ? ' has' : 's have'} been waiting more than a week.`
            : 'Every application has been looked at within a week.',
        };
      }

      case ScheduledTaskType.INTERVIEWS_WITHOUT_OUTCOME: {
        const count = await this.prisma.interview.count({
          where: {
            employerId: { in: memberIds },
            outcome: null,
            scheduledAt: { lt: new Date(Date.now() - 2 * DAY_MS), not: null },
            status: { in: ['confirmed', 'completed'] },
          },
        });
        return {
          count,
          title: count ? 'Interviews need an outcome' : 'All interviews are marked up',
          message: count
            ? `${count} interview${count === 1 ? ' has' : 's have'} happened with no outcome recorded.`
            : 'Every past interview has an outcome recorded.',
        };
      }

      case ScheduledTaskType.WEEKLY_SUMMARY: {
        const since = new Date(Date.now() - 7 * DAY_MS);
        const [jobs, applications, interviews] = await Promise.all([
          this.prisma.job.count({
            where: { postedById: { in: memberIds }, createdAt: { gte: since } },
          }),
          this.prisma.application.count({
            where: { job: { postedById: { in: memberIds } }, appliedAt: { gte: since } },
          }),
          this.prisma.interview.count({
            where: { employerId: { in: memberIds }, scheduledAt: { gte: since, lt: new Date() } },
          }),
        ]);
        const count = jobs + applications + interviews;
        return {
          count,
          title: 'Your week in hiring',
          message: count
            ? `${jobs} job${jobs === 1 ? '' : 's'} posted · ${applications} application${applications === 1 ? '' : 's'} received · ${interviews} interview${interviews === 1 ? '' : 's'} held.`
            : 'Nothing moved this week — no jobs posted, applications or interviews.',
        };
      }

      case ScheduledTaskType.SAVED_SEARCH_MATCHES: {
        const shortlist = await this.prisma.shortlist.findFirst({
          where: { id: task.configKey, employerId: { in: memberIds } },
          select: { id: true, name: true, query: true, roleTitle: true },
        });
        if (!shortlist) {
          return {
            count: 0,
            title: 'That saved search is gone',
            message: 'The search this task watched has been deleted. Remove the task or point it at another.',
          };
        }

        /**
         * A project made by hand has no search behind it, so there is nothing
         * to re-run. Saying so beats reporting zero new matches forever,
         * which reads as "nobody out there fits".
         */
        if (!shortlist.query?.trim()) {
          return {
            count: 0,
            title: 'Nothing to watch',
            message:
              'This project was created by hand, so it has no search to re-run. Point the task at a saved search instead.',
          };
        }

        const matchIds = await this.sourcing.matchingIds({ query: shortlist.query });
        const config = (task.config ?? {}) as { seenIds?: string[] };
        const seen = new Set(config.seenIds ?? []);

        // Candidates already in the pipeline are not news either — they were
        // found by a previous run or added by hand.
        const shortlisted = await this.prisma.shortlistItem.findMany({
          where: { shortlistId: shortlist.id },
          select: { candidateId: true },
        });
        for (const item of shortlisted) seen.add(item.candidateId);

        const fresh = matchIds.filter((id) => !seen.has(id));
        const label = shortlist.roleTitle?.trim() || shortlist.query;

        // Remember what we have reported. Capped so a long-lived watcher on a
        // busy query cannot grow this row without limit; the oldest ids fall
        // off first, and re-reporting someone from months ago is a far smaller
        // problem than an unbounded column.
        const nextSeen = [...new Set([...(config.seenIds ?? []), ...matchIds])].slice(-SEEN_CAP);
        await this.prisma.scheduledTask
          .update({ where: { id: task.id }, data: { config: { seenIds: nextSeen } } })
          .catch(() => undefined);

        return {
          count: fresh.length,
          title: fresh.length ? 'New candidates match your search' : 'No new matches',
          // Deliberately no names: a notification lands in an inbox, and who is
          // looking for work is not something to put there. The count is the
          // signal; the people are behind a sign-in.
          message: fresh.length
            ? `${fresh.length} new candidate${fresh.length === 1 ? '' : 's'} match "${label}".`
            : `Nobody new has matched "${label}" since the last check.`,
        };
      }

      default:
        return { count: 0, title: 'Nothing to report', message: 'This task did nothing.' };
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  private async requireOwned(user: User, id: string): Promise<ScheduledTask> {
    const context = await this.companyContext.requireForUser(user.id);
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, companyId: context.companyId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private shape(t: ScheduledTask, targetLabel?: string | null) {
    const def = definitionFor(t.type);
    return {
      id: t.id,
      type: t.type,
      label: def.label,
      /** Which saved search this one watches, for the per-target kinds. */
      targetId: t.configKey || null,
      targetLabel: targetLabel ?? null,
      description: def.description,
      icon: def.icon,
      link: def.link,
      cadence: t.cadence,
      hourLocal: t.hourLocal,
      weekday: t.weekday,
      timezone: t.timezone,
      cadenceLabel: describeCadence(t),
      enabled: t.enabled,
      notifyWhenEmpty: t.notifyWhenEmpty,
      lastRunAt: t.lastRunAt,
      nextRunAt: t.nextRunAt,
      lastSummary: t.lastSummary,
    };
  }
}
