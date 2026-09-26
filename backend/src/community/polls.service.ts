import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export interface PollInput {
  options: string[];
  /** ISO date. Omitted means the poll stays open. */
  closesAt?: string;
}

/**
 * Polls on community posts.
 *
 * The one design decision worth stating: counts are withheld until you have
 * voted or the poll has closed. Showing a running tally to someone still
 * deciding turns a poll into a bandwagon — the first few votes then decide the
 * rest, and the result measures order of arrival rather than opinion.
 */
@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Attaches a poll to a post that was just created. */
  async createForPost(postId: string, input: PollInput) {
    const labels = input.options.map((o) => o.trim()).filter(Boolean);
    const unique = [...new Set(labels)];

    if (unique.length < MIN_OPTIONS) {
      throw new BadRequestException(`A poll needs at least ${MIN_OPTIONS} different choices.`);
    }
    if (unique.length > MAX_OPTIONS) {
      throw new BadRequestException(`A poll can have at most ${MAX_OPTIONS} choices.`);
    }

    const closesAt = input.closesAt ? new Date(input.closesAt) : null;
    if (closesAt && closesAt.getTime() <= Date.now()) {
      throw new BadRequestException('The closing time has already passed.');
    }

    return this.prisma.poll.create({
      data: {
        postId,
        closesAt,
        options: { create: unique.map((label, position) => ({ label, position })) },
      },
      select: { id: true },
    });
  }

  /**
   * The poll as one viewer should see it.
   *
   * `counts` is null while results are withheld, rather than zeroes — a zero
   * is a real tally and would be read as one.
   */
  async forViewer(postId: string, userId?: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { postId },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { votes: true } },
      },
    });
    if (!poll) return null;

    const closed = !!poll.closesAt && poll.closesAt.getTime() <= Date.now();

    const myVote = userId
      ? await this.prisma.pollVote.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId } },
          select: { optionId: true },
        })
      : null;

    const reveal = closed || !!myVote;

    const tallies = reveal
      ? await this.prisma.pollVote.groupBy({
          by: ['optionId'],
          where: { pollId: poll.id },
          _count: { optionId: true },
        })
      : [];
    const byOption = new Map(tallies.map((t) => [t.optionId, t._count.optionId]));

    return {
      id: poll.id,
      closesAt: poll.closesAt,
      closed,
      totalVotes: poll._count.votes,
      myOptionId: myVote?.optionId ?? null,
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        count: reveal ? (byOption.get(o.id) ?? 0) : null,
      })),
    };
  }

  /**
   * Casts or changes a vote.
   *
   * Changing your mind is allowed while the poll is open — an accidental tap
   * should not be permanent, and the unique constraint means it replaces the
   * previous choice rather than adding to it.
   */
  async vote(user: User, pollId: string, optionId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { select: { id: true } }, post: { select: { removedAt: true } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.post.removedAt) {
      throw new ForbiddenException('That post has been removed.');
    }
    if (poll.closesAt && poll.closesAt.getTime() <= Date.now()) {
      throw new BadRequestException('That poll has closed.');
    }
    if (!poll.options.some((o) => o.id === optionId)) {
      throw new BadRequestException('That choice is not on this poll.');
    }

    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: user.id } },
      create: { pollId, optionId, userId: user.id },
      update: { optionId, votedAt: new Date() },
    });

    return this.forViewer((await this.postIdFor(pollId))!, user.id);
  }

  /** Withdraws a vote entirely, which also hides the results again. */
  async unvote(user: User, pollId: string) {
    await this.prisma.pollVote.deleteMany({ where: { pollId, userId: user.id } });
    return this.forViewer((await this.postIdFor(pollId))!, user.id);
  }

  private async postIdFor(pollId: string): Promise<string | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: { postId: true },
    });
    return poll?.postId ?? null;
  }
}
