import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../../common/scheduling/exclusive-cron';
import { CompanyMemberStatus, Prisma, TideRsvp } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyContextService } from '../../company/company-context.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { buildIcs } from '../../integrations/ics.util';
import { CreateTideDto, UpdateTideDto, CancelTideDto, RsvpDto } from './dto/tide.dto';

/** How close a tide must be before the way in is handed out. */
const JOIN_WINDOW_MS = 60 * 60_000;

/** A tide is still "on now" for this long after it starts, for listing. */
const RUNNING_GRACE_MS = 2 * 60 * 60_000;

/**
 * Tides — things happening at a time.
 *
 * Three rules shape everything here:
 *
 * - **The way in is not public.** `joinUrl` is never in a listing and never in
 *   a public read. It goes to people who said they are coming, an hour before
 *   the start. A meeting link anyone can read is a door anyone can walk
 *   through, and a careers event full of strangers is worse than no event.
 * - **A time needs a place to be a time.** Every tide stores the instant in UTC
 *   *and* the host's IANA zone, so a reader gets both the intent ("2pm in
 *   Kampala") and their own clock.
 * - **Cancel, never delete.** People arranged their day around it. They are
 *   told, and they can still see what happened.
 */
@Injectable()
export class TidesService {
  private readonly logger = new Logger(TidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, dto: CreateTideDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.assertTimes(startsAt, endsAt);

    // Same rule as company posts: owners and admins speak for the company.
    let companyId: string | null = null;
    if (dto.asCompany) {
      const context = await this.companyContext.forUser(userId);
      if (!context || !CompanyContextService.canManageMembers(context.role)) {
        throw new ForbiddenException('Only an owner or admin can hold a tide in a company\'s name.');
      }
      companyId = context.companyId;
    }

    /**
     * The tide and its announcement are written together.
     *
     * Separately, a failed post leaves a tide nobody was told about — which
     * looks to the host like nothing happened, so they make it again.
     */
    return this.prisma.$transaction(async (tx) => {
      const tide = await tx.tide.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          hostId: userId,
          companyId,
          startsAt,
          endsAt,
          timezone: dto.timezone,
          mode: dto.mode,
          location: dto.location?.trim() || null,
          joinUrl: dto.joinUrl?.trim() || null,
          bannerUrl: dto.bannerUrl ?? null,
          capacity: dto.capacity ?? null,
        },
        include: this.include(),
      });

      // Announced whether or not it is in a space: without one the
      // announcement is for everyone, like any post. A space that is named
      // must be open, and the host joins it, as anyone posting there does.
      if (dto.spaceId) {
        const space = await tx.space.findUnique({ where: { id: dto.spaceId }, select: { archivedAt: true } });
        if (!space) throw new NotFoundException('Space not found');
        if (space.archivedAt) throw new BadRequestException('That space has been archived.');
        await tx.spaceMember.upsert({
          where: { spaceId_userId: { spaceId: dto.spaceId, userId } },
          create: { spaceId: dto.spaceId, userId },
          update: {},
        });
      }

      await tx.post.create({
        data: {
          authorId: userId,
          companyId,
          spaceId: dto.spaceId ?? null,
          tideId: tide.id,
          postType: 'TIDE',
          // The card carries the title, time and place. Repeating them in
          // the text would be the same thing said twice.
          content: dto.announcement?.trim() || '',
        },
      });

      return tide;
    });
  }

  async update(tideId: string, userId: string, dto: UpdateTideDto) {
    const tide = await this.owned(tideId, userId);
    if (tide.canceledAt) {
      throw new BadRequestException('A cancelled tide cannot be edited.');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : tide.startsAt;
    const endsAt = dto.endsAt !== undefined ? (dto.endsAt ? new Date(dto.endsAt) : null) : tide.endsAt;
    this.assertTimes(startsAt, endsAt, { allowPast: true });

    // Shrinking below the number already coming would mean turning people away
    // who were told they had a place.
    if (dto.capacity != null) {
      const going = await this.prisma.tideAttendee.count({
        where: { tideId, status: TideRsvp.GOING },
      });
      if (dto.capacity < going) {
        throw new BadRequestException(
          `${going} people are already coming. Capacity cannot be set below that.`,
        );
      }
    }

    const moved = dto.startsAt !== undefined && startsAt.getTime() !== tide.startsAt.getTime();

    const updated = await this.prisma.tide.update({
      where: { id: tideId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
        ...(dto.joinUrl !== undefined ? { joinUrl: dto.joinUrl?.trim() || null } : {}),
        ...(dto.bannerUrl !== undefined ? { bannerUrl: dto.bannerUrl } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      },
      include: this.include(),
    });

    // Moving the time is the change people need to hear about; renaming it is
    // not, and a notification for every edit is how the bell gets muted.
    if (moved) {
      void this.tellAttendees(tideId, {
        title: `${updated.title} has moved`,
        message: 'The start time changed. Open it to see when.',
      });
    }

    return updated;
  }

  async cancel(tideId: string, userId: string, dto: CancelTideDto) {
    const tide = await this.owned(tideId, userId);
    if (tide.canceledAt) return tide;

    const updated = await this.prisma.tide.update({
      where: { id: tideId },
      data: { canceledAt: new Date(), cancelReason: dto.reason?.trim() || null },
      include: this.include(),
    });

    void this.tellAttendees(tideId, {
      title: `${updated.title} was cancelled`,
      message: updated.cancelReason || 'The host cancelled it.',
    });

    return updated;
  }

  /**
   * What is coming up.
   *
   * Past tides are excluded unless asked for: a listing whose first item
   * happened last March reads as abandoned, whatever is underneath it.
   */
  async list(params: {
    companyId?: string;
    past?: boolean;
    page?: number;
    limit?: number;
    viewerId?: string;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 50);
    const now = new Date();

    const where: Prisma.TideWhereInput = {
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.past
        ? { startsAt: { lt: new Date(now.getTime() - RUNNING_GRACE_MS) } }
        : { startsAt: { gte: new Date(now.getTime() - RUNNING_GRACE_MS) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.tide.findMany({
        where,
        include: this.include(),
        orderBy: { startsAt: params.past ? 'desc' : 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tide.count({ where }),
    ]);

    return {
      data: await this.shapeMany(data, params.viewerId),
      meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  }

  async getById(tideId: string, viewerId?: string) {
    const tide = await this.prisma.tide.findUnique({
      where: { id: tideId },
      include: this.include(),
    });
    if (!tide) throw new NotFoundException('Tide not found');
    return (await this.shapeMany([tide], viewerId))[0];
  }

  /**
   * Says whether you are coming.
   *
   * Capacity is checked inside the transaction, not before it: two people
   * answering at once must not both get the last place.
   */
  async rsvp(tideId: string, userId: string, dto: RsvpDto) {
    return this.prisma.$transaction(async (tx) => {
      const tide = await tx.tide.findUnique({
        where: { id: tideId },
        select: { id: true, capacity: true, canceledAt: true, startsAt: true },
      });
      if (!tide) throw new NotFoundException('Tide not found');
      if (tide.canceledAt) throw new BadRequestException('That tide was cancelled.');
      if (tide.startsAt.getTime() < Date.now()) {
        throw new BadRequestException('That tide has already started.');
      }

      const existing = await tx.tideAttendee.findUnique({
        where: { tideId_userId: { tideId, userId } },
        select: { id: true, status: true },
      });

      if (tide.capacity != null && dto.status === TideRsvp.GOING && existing?.status !== TideRsvp.GOING) {
        const going = await tx.tideAttendee.count({ where: { tideId, status: TideRsvp.GOING } });
        if (going >= tide.capacity) throw new BadRequestException('That tide is full.');
      }

      return tx.tideAttendee.upsert({
        where: { tideId_userId: { tideId, userId } },
        create: { tideId, userId, status: dto.status },
        update: { status: dto.status },
      });
    });
  }

  /** Takes your name off it. */
  async withdraw(tideId: string, userId: string) {
    await this.prisma.tideAttendee
      .delete({ where: { tideId_userId: { tideId, userId } } })
      .catch(() => undefined);
    return { success: true };
  }

  /**
   * A calendar file anyone's calendar understands.
   *
   * Deliberately no OAuth: an .ics works in Outlook, Google and Apple without
   * anyone connecting an account, which is the difference between "add to
   * calendar" being one click and being a permissions dialog.
   *
   * It carries a link to the tide page, **never the join URL**. Someone can
   * RSVP days ahead, and the way in is not released until an hour before — an
   * .ics with a live meeting link inside it would route straight around that.
   */
  async ics(tideId: string) {
    const tide = await this.prisma.tide.findUnique({
      where: { id: tideId },
      select: {
        id: true, title: true, description: true, startsAt: true, endsAt: true,
        location: true, mode: true, canceledAt: true, updatedAt: true,
        company: { select: { name: true } },
      },
    });
    if (!tide) throw new NotFoundException('Tide not found');

    const base = this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081';
    const minutes = tide.endsAt
      ? Math.max(Math.round((tide.endsAt.getTime() - tide.startsAt.getTime()) / 60_000), 15)
      : 60;

    const content = buildIcs({
      uid: `tide-${tide.id}@coral`,
      title: tide.company ? `${tide.title} — ${tide.company.name}` : tide.title,
      description: tide.description ?? undefined,
      start: tide.startsAt,
      durationMins: minutes,
      location: tide.location ?? undefined,
      url: `${base}/community/tides/${tide.id}`,
      // A cancelled tide still downloads, as a cancellation: someone who
      // already added it needs their calendar to hear that it is off.
      method: tide.canceledAt ? 'CANCEL' : 'PUBLISH',
      status: tide.canceledAt ? 'CANCELLED' : 'CONFIRMED',
      // Bumped whenever the tide changes, so a re-download replaces the old
      // entry rather than sitting beside it.
      sequence: Math.floor(tide.updatedAt.getTime() / 1000),
    });

    return { filename: `tide-${tide.id}.ics`, content };
  }

  /**
   * Tells people a tide is about to start.
   *
   * Timed to the join window, not to some round number: the reminder and the
   * way in become available together, so the message is "you can go in now"
   * rather than "remember this thing, come back later for the link".
   *
   * Runs every five minutes. The window is an hour wide, so the worst case is
   * a reminder fifty-five minutes ahead instead of sixty — and a sweep that
   * ran every minute would do twelve times the work for that.
   */
  @ExclusiveCron(CronExpression.EVERY_5_MINUTES, { name: 'tide-reminders' })
  async sweepReminders(): Promise<void> {
    try {
      const now = Date.now();
      const due = await this.prisma.tide.findMany({
        where: {
          remindedAt: null,
          canceledAt: null,
          // Inside the window, and not already started. A tide that began
          // before the sweep woke up is not something to remind anyone about.
          startsAt: { gt: new Date(now), lte: new Date(now + JOIN_WINDOW_MS) },
        },
        select: { id: true, title: true },
      });

      for (const tide of due) {
        /**
         * Stamped before the sending, not after.
         *
         * If a send throws halfway through, the tide is already marked and the
         * next sweep leaves it alone. Some attendees missing a reminder is a
         * far smaller failure than every attendee being reminded again every
         * five minutes until the tide starts.
         */
        await this.prisma.tide.update({
          where: { id: tide.id },
          data: { remindedAt: new Date() },
        });

        const attendees = await this.prisma.tideAttendee.findMany({
          where: { tideId: tide.id },
          select: { userId: true, status: true },
        });

        for (const attendee of attendees) {
          const going = attendee.status === TideRsvp.GOING;
          await this.notifications.create({
            userId: attendee.userId,
            type: 'community',
            title: `${tide.title} starts within the hour`,
            // Only people who are going get the way in, so only they are told
            // it is open. Promising a link to someone who cannot use it is
            // worse than not writing to them at all.
            message: going
              ? 'The way in is open now.'
              : 'You said you were interested. Say you are going to get the way in.',
            link: `/community/tides/${tide.id}`,
          });
        }
      }
    } catch (err) {
      // A failed sweep must not take the scheduler down with it; the next one
      // picks up whatever is still unstamped.
      this.logger.error(
        `Tide reminder sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---- internals -----------------------------------------------------------------------

  private include() {
    return {
      company: { select: { id: true, name: true } },
      host: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { attendees: true } },
    };
  }

  /**
   * Adds the viewer's own answer, the number coming, and the way in — the last
   * only for people who are coming, and only once it is close.
   */
  private async shapeMany(
    tides: Array<Prisma.TideGetPayload<{ include: ReturnType<TidesService['include']> }>>,
    viewerId?: string,
  ) {
    const ids = tides.map((t) => t.id);
    const mine = viewerId
      ? await this.prisma.tideAttendee.findMany({
          where: { tideId: { in: ids }, userId: viewerId },
          select: { tideId: true, status: true },
        })
      : [];
    const byTide = new Map(mine.map((a) => [a.tideId, a.status]));

    const going = await this.prisma.tideAttendee.groupBy({
      by: ['tideId'],
      where: { tideId: { in: ids }, status: TideRsvp.GOING },
      _count: { _all: true },
    });
    const goingByTide = new Map(going.map((g) => [g.tideId, g._count._all]));

    const now = Date.now();
    return tides.map((tide) => {
      const myStatus = byTide.get(tide.id) ?? null;
      const soon = tide.startsAt.getTime() - now <= JOIN_WINDOW_MS;
      const mayJoin = myStatus === TideRsvp.GOING && soon && !tide.canceledAt;
      const { joinUrl, ...rest } = tide;
      return {
        ...rest,
        goingCount: goingByTide.get(tide.id) ?? 0,
        myRsvp: myStatus,
        /**
         * Present only when this reader may actually use it. Withheld rather
         * than nulled everywhere else, so a listing can never leak it.
         */
        joinUrl: mayJoin ? joinUrl : null,
        /** True when a link exists but it is not time yet — the UI says so. */
        joinOpensLater: !!joinUrl && myStatus === TideRsvp.GOING && !soon,
      };
    });
  }

  private assertTimes(startsAt: Date, endsAt: Date | null, opts: { allowPast?: boolean } = {}) {
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('That start time is not a date.');
    }
    if (!opts.allowPast && startsAt.getTime() < Date.now()) {
      throw new BadRequestException('A tide cannot start in the past.');
    }
    if (endsAt) {
      if (Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('That end time is not a date.');
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        throw new BadRequestException('It has to end after it starts.');
      }
    }
  }

  /** Personal host, or a current active owner/admin of the company holding it. */
  private async owned(tideId: string, userId: string) {
    const tide = await this.prisma.tide.findUnique({ where: { id: tideId } });
    if (!tide) throw new NotFoundException('Tide not found');

    if (tide.companyId) {
      // The historical host remains attributed, but a revoked seat cannot
      // keep changing the company's event. Resolve the exact record's seat.
      const membership = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: tide.companyId, userId } },
        select: { role: true, status: true },
      });
      if (
        membership?.status === CompanyMemberStatus.ACTIVE &&
        CompanyContextService.canManageMembers(membership.role)
      ) {
        return tide;
      }
      throw new ForbiddenException('Only a current owner or admin of this company can change its tide.');
    }
    if (tide.hostId === userId) return tide;
    throw new ForbiddenException('Only the host can change this tide.');
  }

  /** Everyone who said they were coming or interested. */
  private async tellAttendees(tideId: string, note: { title: string; message: string }) {
    const attendees = await this.prisma.tideAttendee.findMany({
      where: { tideId },
      select: { userId: true },
    });
    for (const a of attendees) {
      await this.notifications.create({
        userId: a.userId,
        type: 'community',
        title: note.title,
        message: note.message,
        link: `/community/tides/${tideId}`,
      });
    }
  }
}
