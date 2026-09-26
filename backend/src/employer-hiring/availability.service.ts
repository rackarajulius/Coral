import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../common/types/user.types';
import { InterviewService } from './interview.service';
import { AddSlotsDto } from './dto/add-slots.dto';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly interviews: InterviewService,
  ) {}

  /** The employer's own slots (open + booked), soonest first. */
  listMine(employer: User) {
    return this.prisma.availabilitySlot.findMany({
      where: { employerId: employer.id, status: { not: 'cancelled' } },
      orderBy: { startAt: 'asc' },
      take: 200,
    });
  }

  /** Publishes one or more open time slots (future-only, de-duplicated). */
  async addSlots(employer: User, dto: AddSlotsDto) {
    const now = Date.now();
    const seen = new Set<string>();
    const rows = dto.slots
      .map((s) => new Date(s))
      .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now)
      .filter((d) => {
        const k = d.toISOString();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((d) => ({
        employerId: employer.id,
        role: dto.role ?? null,
        startAt: d,
        durationMins: dto.durationMins ?? 30,
        medium: dto.medium ?? 'video',
      }));

    if (rows.length === 0) throw new BadRequestException('Provide at least one future time slot');
    await this.prisma.availabilitySlot.createMany({ data: rows });
    return this.listMine(employer);
  }

  /** Removes an open slot (booked slots must be cancelled via the interview). */
  async removeSlot(employer: User, id: string) {
    const slot = await this.prisma.availabilitySlot.findFirst({ where: { id, employerId: employer.id } });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status === 'booked') {
      throw new BadRequestException('That slot is already booked — cancel the interview instead.');
    }
    await this.prisma.availabilitySlot.delete({ where: { id } });
    return { ok: true };
  }

  /** Public booking page: an employer's open future slots + company name. */
  async bookingPage(employerId: string) {
    const [employer, slots] = await Promise.all([
      this.prisma.employerProfile.findUnique({
        where: { userId: employerId },
        select: { companyName: true },
      }),
      this.prisma.availabilitySlot.findMany({
        where: { employerId, status: 'open', startAt: { gt: new Date() } },
        orderBy: { startAt: 'asc' },
        take: 100,
      }),
    ]);

    // Never leak whether the id maps to a real employer — just return what's bookable.
    return {
      employerId,
      company: employer?.companyName?.trim() || 'This employer',
      slots: slots.map((s) => ({
        id: s.id,
        startAt: s.startAt,
        durationMins: s.durationMins,
        role: s.role,
        medium: s.medium,
      })),
    };
  }

  /** Candidate books an open slot → confirmed Interview (atomic against double-booking). */
  async book(candidate: User, slotId: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.status !== 'open') throw new NotFoundException('That time is no longer available');
    if (slot.startAt.getTime() <= Date.now()) throw new BadRequestException('That time has passed');
    if (slot.employerId === candidate.id) throw new BadRequestException("You can't book your own availability");

    const interview = await this.prisma.interview.create({
      data: {
        employerId: slot.employerId,
        candidateId: candidate.id,
        role: slot.role,
        medium: slot.medium,
        proposedSlots: [slot.startAt.toISOString()],
        scheduledAt: slot.startAt,
        status: 'confirmed',
      },
    });

    // Claim the slot only if still open; otherwise we lost a race → roll back.
    const claim = await this.prisma.availabilitySlot.updateMany({
      where: { id: slot.id, status: 'open' },
      data: { status: 'booked', interviewId: interview.id },
    });
    if (claim.count === 0) {
      await this.prisma.interview.delete({ where: { id: interview.id } }).catch(() => undefined);
      throw new BadRequestException('That time was just taken — please pick another.');
    }

    const candidateName =
      candidate.displayName ||
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') ||
      'A candidate';
    await this.notifications.create({
      userId: slot.employerId,
      type: 'interview',
      title: `${candidateName} booked an interview`,
      message: `${slot.startAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}${slot.role ? ` · ${slot.role}` : ''}`,
      link: '/employers/candidates',
    });
    await this.interviews.sendConfirmationEmail(interview.id);

    return interview;
  }
}
