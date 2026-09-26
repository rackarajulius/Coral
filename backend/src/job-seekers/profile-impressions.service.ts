import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

/** How long an impression is kept. Matches the window the profile reports. */
export const IMPRESSION_RETENTION_DAYS = 90;

export type ImpressionType = 'view' | 'search';

/**
 * How a viewer appears to the person they looked at.
 *
 * - `named`   — full name and headline. Opt-in only.
 * - `company` — "a recruiter at Acme". The employer default, and the same
 *   logic the rest of this product uses: consent runs to the company, not to
 *   the individual, so a view is attributed the same way an application is.
 * - `private` — invisible, and the trade is symmetrical: a private viewer
 *   cannot see their own viewer list either. Without that symmetry the feature
 *   is one-sided surveillance.
 */
export const VIEW_VISIBILITIES = ['named', 'company', 'private'] as const;
export type ViewVisibility = (typeof VIEW_VISIBILITIES)[number];

/**
 * The default when someone has never chosen.
 *
 * Employers are attributed to their company: it is useful to a candidate
 * ("Acme looked at me twice"), it does not expose which recruiter is scouting
 * whom, and it matches how consent already flows. Everyone else is private —
 * a jobseeker browsing another jobseeker has no company to stand behind and no
 * expectation of being named.
 */
export function defaultVisibilityFor(role: string): ViewVisibility {
  return role === 'EMPLOYER' ? 'company' : 'private';
}

/**
 * Counts who saw a candidate, honestly.
 *
 * Two things are recorded: a **view** (someone opened the profile) and a
 * **search appearance** (the profile came back in an employer's candidate
 * search). The profile used to display "847 profile views · 23 search
 * appearances" — the same two invented numbers on every account — because
 * neither had ever been measured. This measures them.
 *
 * Three decisions worth keeping:
 *
 * - **Deduped per viewer per day.** A recruiter refreshing a profile is one
 *   view, and re-running the same search all afternoon is one appearance.
 *   Counting raw hits would produce a number that flatters and means nothing.
 * - **Self and admin traffic are never counted.** Looking at your own profile
 *   is not interest in you, and an admin opening a record for support reasons
 *   is not a recruiter finding you.
 * - **No identity is inferred from the network.** Both entry points require a
 *   session, so there is nothing to fingerprint — no IP, no user agent, no
 *   hashed session, unlike the employer-side analytics which must handle
 *   logged-out visitors.
 *
 * Writes are fire-and-forget: a failure here must never break the page the
 * viewer actually asked for.
 */
@Injectable()
export class ProfileImpressionsService {
  private readonly logger = new Logger(ProfileImpressionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /** Midnight UTC for a timestamp — the dedupe dimension. */
  private static day(at = new Date()): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  }

  /** True when this viewer's interest in this candidate should be counted. */
  private countable(viewer: User, jobSeekerId: string): boolean {
    if (viewer.id === jobSeekerId) return false;
    if (viewer.role === 'ADMIN') return false;
    return true;
  }

  /**
   * Records one impression. Never throws.
   *
   * `createMany` with `skipDuplicates` leans on the unique index to do the
   * deduping in the database, so two simultaneous views cannot both land.
   */
  async record(viewer: User, jobSeekerIds: string[], type: ImpressionType): Promise<void> {
    const subjects = jobSeekerIds.filter((id) => this.countable(viewer, id));
    if (subjects.length === 0) return;

    try {
      const context = await this.companyContext.forUser(viewer.id);
      const day = ProfileImpressionsService.day();
      let visibility = await this.visibilityOf(viewer.id, viewer.role);
      // Company attribution needs a company. Without one it degrades to
      // private rather than silently naming the person.
      if (visibility === 'company' && !context?.companyId) visibility = 'private';

      await this.prisma.profileImpression.createMany({
        data: subjects.map((jobSeekerId) => ({
          jobSeekerId,
          type,
          viewerId: viewer.id,
          viewerCompanyId: context?.companyId ?? null,
          viewerVisibility: visibility,
          day,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      // A miscounted impression is not worth failing a request over.
      this.logger.warn(
        `Could not record ${type} impression: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /**
   * What the candidate is shown about themselves.
   *
   * `since` is the honest part. Counting started when this shipped, so a new
   * account is not told "0 views in 90 days" as though we had been watching
   * all along — the UI says "since {date}", and that date is the later of the
   * window edge and the day tracking began.
   */
  async statsFor(userId: string, days = IMPRESSION_RETENTION_DAYS) {
    const windowStart = ProfileImpressionsService.day(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    );

    const [grouped, firstEver] = await Promise.all([
      this.prisma.profileImpression.groupBy({
        by: ['type'],
        where: { jobSeekerId: userId, day: { gte: windowStart } },
        _count: { _all: true },
      }),
      // The oldest row anywhere: the day this started being measured at all.
      this.prisma.profileImpression.findFirst({
        orderBy: { day: 'asc' },
        select: { day: true },
      }),
    ]);

    const countOf = (type: ImpressionType) =>
      grouped.find((g) => g.type === type)?._count._all ?? 0;

    const trackingSince = firstEver?.day ?? ProfileImpressionsService.day();

    return {
      views: countOf('view'),
      searchAppearances: countOf('search'),
      windowDays: days,
      /** Nothing before this was counted, so nothing before it is claimed. */
      since: (trackingSince > windowStart ? trackingSince : windowStart).toISOString(),
    };
  }

  /* ----------------------------- who viewed you ---------------------------- */

  /** The viewer's own choice, or their role's default when they never made one. */
  async visibilityOf(userId: string, role: string): Promise<ViewVisibility> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileViewVisibility: true },
    });
    const stored = user?.profileViewVisibility as ViewVisibility | null | undefined;
    return stored && VIEW_VISIBILITIES.includes(stored) ? stored : defaultVisibilityFor(role);
  }

  /** Changes it. Applies to future views only — past rows keep their snapshot. */
  async setVisibility(userId: string, visibility: ViewVisibility) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileViewVisibility: visibility },
    });
    return { visibility };
  }

  /**
   * Who looked at you, as far as each viewer allowed.
   *
   * Locked for a viewer who browses privately: the same switch decides whether
   * others see you and whether you see them. Counts stay visible either way —
   * they are aggregate, and about nobody in particular.
   *
   * Rows are grouped per viewer, so a recruiter who came back on three days is
   * one entry with a count, not three lines.
   */
  async viewersFor(user: User, limit = 20) {
    const mine = await this.visibilityOf(user.id, user.role);
    if (mine === 'private') {
      return {
        locked: true as const,
        /** Said plainly, because it is a trade the person can undo. */
        reason:
          'You browse profiles privately, so you cannot see who viewed yours. Change this in Settings › Privacy.',
        viewers: [],
        privateCount: 0,
      };
    }

    const windowStart = ProfileImpressionsService.day(
      new Date(Date.now() - IMPRESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    );

    const rows = await this.prisma.profileImpression.findMany({
      where: { jobSeekerId: user.id, type: 'view', day: { gte: windowStart } },
      orderBy: { occurredAt: 'desc' },
      select: {
        viewerId: true,
        viewerVisibility: true,
        occurredAt: true,
        viewer: {
          select: { displayName: true, firstName: true, lastName: true, avatarUrl: true, jobSeekerProfile: { select: { headline: true } } },
        },
        // Company has no logo column; the row renders an initial instead.
        company: { select: { id: true, name: true } },
      },
    });

    // Anyone who looked in private is a number, never a row — including how
    // many of them there were, which is the most that can be said honestly.
    const privateCount = new Set(
      rows.filter((r) => r.viewerVisibility === 'private').map((r) => r.viewerId),
    ).size;

    const grouped = new Map<
      string,
      { kind: 'named' | 'company'; name: string; subtitle: string | null; avatarUrl: string | null; companyId: string | null; lastViewedAt: Date; views: number }
    >();

    for (const row of rows) {
      if (row.viewerVisibility === 'private') continue;

      // Company viewers collapse by company: three recruiters at one firm read
      // as that firm looking at you, which is what it is.
      const key = row.viewerVisibility === 'company' ? `c:${row.company?.id ?? row.viewerId}` : `u:${row.viewerId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.views += 1;
        continue;
      }

      if (row.viewerVisibility === 'company' && row.company) {
        grouped.set(key, {
          kind: 'company',
          name: row.company.name,
          subtitle: 'Someone on this hiring team',
          avatarUrl: null,
          companyId: row.company.id,
          lastViewedAt: row.occurredAt,
          views: 1,
        });
      } else if (row.viewerVisibility === 'named') {
        const v = row.viewer;
        grouped.set(key, {
          kind: 'named',
          name:
            v.displayName?.trim() ||
            [v.firstName, v.lastName].filter(Boolean).join(' ').trim() ||
            'A member',
          subtitle: v.jobSeekerProfile?.headline ?? null,
          avatarUrl: v.avatarUrl ?? null,
          companyId: null,
          lastViewedAt: row.occurredAt,
          views: 1,
        });
      }
    }

    return {
      locked: false as const,
      reason: null,
      viewers: Array.from(grouped.values())
        .sort((a, b) => b.lastViewedAt.getTime() - a.lastViewedAt.getTime())
        .slice(0, limit)
        .map((v) => ({ ...v, lastViewedAt: v.lastViewedAt.toISOString() })),
      privateCount,
    };
  }

  /**
   * Drops impressions past the retention window.
   *
   * The profile only ever reports the last 90 days, so keeping more would be
   * holding a record of who looked at whom for no stated purpose.
   */
  @ExclusiveCron(CronExpression.EVERY_DAY_AT_3AM, { name: 'profile-impression-retention' })
  async pruneExpired(): Promise<void> {
    const cutoff = ProfileImpressionsService.day(
      new Date(Date.now() - IMPRESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    );
    try {
      const { count } = await this.prisma.profileImpression.deleteMany({
        where: { day: { lt: cutoff } },
      });
      if (count > 0) this.logger.log(`Pruned ${count} profile impressions older than ${IMPRESSION_RETENTION_DAYS} days`);
    } catch (error) {
      this.logger.error(
        `Impression prune failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
