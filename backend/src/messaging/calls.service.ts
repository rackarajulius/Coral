import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ExclusiveCron } from '../common/scheduling/exclusive-cron';
import { CallMode, CallState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

/** How long an unanswered call rings before it becomes a missed call. */
const RING_TIMEOUT_MS = 45_000;

/**
 * Ad-hoc calls between an employer and a candidate.
 *
 * The media never reaches this server — it is peer-to-peer WebRTC signalled
 * over the conversation's existing Realtime channel. What lives here is the
 * part a scheduled interview never needs: letting the other person know a call
 * is happening now, letting them refuse it, and leaving an honest record in the
 * thread afterwards.
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  /**
   * Starts a call.
   *
   * Consent is inherited from the conversation rather than checked separately:
   * a thread only exists once the candidate applied to this company, and a call
   * must not be reachable on any looser terms than a message is.
   */
  async start(user: User, conversationId: string, mode: CallMode) {
    const { convo, isEmployerSide } = await this.requireParticipant(user, conversationId);

    // One live call per conversation. Two overlapping invitations would ring
    // twice and leave whichever loses stuck as "ringing" forever.
    const existing = await this.prisma.call.findFirst({
      where: {
        conversationId,
        state: { in: [CallState.RINGING, CallState.ACCEPTED] },
        startedAt: { gt: new Date(Date.now() - RING_TIMEOUT_MS) },
      },
    });
    if (existing) {
      throw new BadRequestException('There is already a call in progress in this conversation.');
    }

    const call = await this.prisma.call.create({
      data: {
        conversationId,
        callerId: user.id,
        calleeId: isEmployerSide ? convo.candidateId : convo.employerId,
        mode,
      },
    });
    return this.shape(call);
  }

  /** The callee picks up. */
  async accept(user: User, callId: string) {
    const call = await this.requireCallParty(user, callId);
    if (call.calleeId !== user.id) {
      throw new ForbiddenException('Only the person being called can answer.');
    }
    if (call.state !== CallState.RINGING) {
      throw new BadRequestException('That call is no longer ringing.');
    }
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { state: CallState.ACCEPTED, answeredAt: new Date() },
    });
    return this.shape(updated);
  }

  async decline(user: User, callId: string) {
    const call = await this.requireCallParty(user, callId);
    if (call.state !== CallState.RINGING) return this.shape(call);

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { state: CallState.DECLINED, endedAt: new Date() },
    });
    await this.writeThreadNote(updated);
    return this.shape(updated);
  }

  /**
   * Ends a call.
   *
   * `failed` is passed by the client when the peer connection never
   * established. That is a real outcome here: signalling works but media is
   * STUN-only with no TURN relay, so strict networks cannot connect — and
   * telling someone "no answer" when the other person was looking right at the
   * screen would be a lie.
   */
  async end(user: User, callId: string, failed = false) {
    const call = await this.requireCallParty(user, callId);
    if (call.endedAt) return this.shape(call);

    const endedAt = new Date();
    const state = failed
      ? CallState.FAILED
      : call.state === CallState.ACCEPTED
        ? CallState.ENDED
        : CallState.MISSED;

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        state,
        endedAt,
        // Only measured from the moment it was answered; an unanswered call has
        // no duration rather than a duration of zero.
        durationSec: call.answeredAt
          ? Math.max(Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000), 0)
          : null,
      },
    });
    await this.writeThreadNote(updated);
    return this.shape(updated);
  }

  /** Current state, so a client that lost the Realtime event can catch up. */
  async get(user: User, callId: string) {
    const call = await this.requireCallParty(user, callId);
    // Resolved lazily as well as by the sweeper: a client polling a call that
    // rang out should not see it stuck at "ringing" until the next minute.
    if (call.state === CallState.RINGING && this.hasRungOut(call.startedAt)) {
      return this.shape(await this.markMissed(call.id));
    }
    return this.shape(call);
  }

  /** Calls in a conversation, newest first — the thread's call history. */
  async listForConversation(user: User, conversationId: string) {
    await this.requireParticipant(user, conversationId);
    const rows = await this.prisma.call.findMany({
      where: { conversationId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.shape(r));
  }

  /**
   * Anything still ringing past the timeout becomes a missed call.
   *
   * Needed because the caller's browser may simply have gone away — closing
   * the tab sends no "cancel", and without this the row rings forever and
   * blocks the next call in that conversation.
   */
  @ExclusiveCron(CronExpression.EVERY_MINUTE, { name: 'call-ring-timeout' })
  async sweepRinging(): Promise<void> {
    try {
      const stale = await this.prisma.call.findMany({
        where: {
          state: CallState.RINGING,
          startedAt: { lt: new Date(Date.now() - RING_TIMEOUT_MS) },
        },
        take: 100,
      });
      for (const call of stale) await this.markMissed(call.id);
    } catch (err) {
      this.logger.error(`Call ring timeout sweep failed: ${(err as Error).message}`);
    }
  }

  /* ------------------------------- helpers -------------------------------- */

  private hasRungOut(startedAt: Date): boolean {
    return Date.now() - startedAt.getTime() > RING_TIMEOUT_MS;
  }

  private async markMissed(callId: string) {
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { state: CallState.MISSED, endedAt: new Date() },
    });
    await this.writeThreadNote(updated);
    return updated;
  }

  /**
   * Leaves a line in the conversation.
   *
   * A call that happened outside the thread would otherwise be invisible: the
   * candidate sees no trace of having been rung, and neither side can tell
   * later what was attempted. Written as a message from the caller so it sits
   * in sequence with everything else.
   */
  private async writeThreadNote(call: {
    id: string;
    conversationId: string;
    callerId: string;
    mode: CallMode;
    state: CallState;
    durationSec: number | null;
  }): Promise<void> {
    const kind = call.mode === CallMode.VIDEO ? 'Video call' : 'Audio call';
    const body =
      call.state === CallState.ENDED && call.durationSec != null
        ? `${kind} · ${formatDuration(call.durationSec)}`
        : call.state === CallState.DECLINED
          ? `${kind} declined`
          : call.state === CallState.FAILED
            ? `${kind} couldn't connect`
            : `Missed ${kind.toLowerCase()}`;

    try {
      await this.prisma.$transaction([
        this.prisma.message.create({
          data: { conversationId: call.conversationId, senderId: call.callerId, body },
        }),
        this.prisma.conversation.update({
          where: { id: call.conversationId },
          data: { lastMessageAt: new Date() },
        }),
      ]);
    } catch (err) {
      // A missing line in the thread must not fail ending a call.
      this.logger.warn(`Could not write call note: ${(err as Error).message}`);
    }
  }

  private async requireCallParty(user: User, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== user.id && call.calleeId !== user.id) {
      // Re-checked against the conversation as well: a colleague who can see
      // the thread may legitimately pick a call up, but nobody else may.
      await this.requireParticipant(user, call.conversationId);
    }
    return call;
  }

  private async requireParticipant(user: User, conversationId: string) {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    if (convo.candidateId === user.id) return { convo, isEmployerSide: false };

    // The employer side is company-wide, matching the shared inbox.
    const memberIds = await this.companyContext.memberUserIds(user.id);
    if (convo.employerId === user.id || memberIds.includes(convo.employerId)) {
      return { convo, isEmployerSide: true };
    }
    throw new ForbiddenException('You are not a participant in this conversation');
  }

  private shape(call: {
    id: string;
    conversationId: string;
    callerId: string;
    calleeId: string;
    mode: CallMode;
    state: CallState;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    durationSec: number | null;
  }) {
    return {
      id: call.id,
      conversationId: call.conversationId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      mode: call.mode,
      state: call.state,
      startedAt: call.startedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      durationSec: call.durationSec,
      /** Both sides join this Realtime channel to negotiate the peer connection. */
      channelName: `call-${call.id}`,
      /** The caller creates the WebRTC offer; the callee answers. */
      ringTimeoutMs: RING_TIMEOUT_MS,
    };
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
