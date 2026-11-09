import { BadRequestException } from '@nestjs/common';
import { ctaColumns, publicWebAddress } from '../../../src/community/posts/post-cta';
import { PostsService } from '../../../src/community/posts/posts.service';
import { PostStatsService } from '../../../src/community/post-stats/post-stats.service';
import { User } from '../../../src/common/types/user.types';

/**
 * A call-to-action bar under a post, as on LinkedIn's sponsored posts: a
 * headline, a link and a button from a fixed list, and its clicks counted
 * once per person per day, as views are.
 */

const POST = 'dddddddd-0000-4000-8000-000000000001';
const AUTHOR = { id: 'author', role: 'JOB_SEEKER' } as User;
const READER = { id: 'reader', role: 'JOB_SEEKER' } as User;

describe('Where a button may lead', () => {
  it('a public web address, taking one typed without https:// as https', () => {
    expect(publicWebAddress('https://example.com/launch?ref=coral')).toBe('https://example.com/launch?ref=coral');
    expect(publicWebAddress('example.com/book')).toBe('https://example.com/book');
    expect(publicWebAddress('http://shop.example.co.ug')).toBe('http://shop.example.co.ug/');
  });

  it('never a script, a file, or another kind of link', () => {
    for (const raw of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com/file', 'file:///etc/passwd', 'mailto:a@example.com']) {
      expect(publicWebAddress(raw)).toBeNull();
    }
  });

  it("never the reader's own machine, router or office network", () => {
    for (const raw of [
      'http://localhost:3000', 'http://127.0.0.1', 'http://192.168.1.1/admin', 'http://10.0.0.5',
      'http://169.254.169.254/latest', 'http://intranet/payroll', 'https://metadata.internal', 'http://[::1]/',
    ]) {
      expect(publicWebAddress(raw)).toBeNull();
    }
  });

  it('never a link dressed up as another site', () => {
    expect(publicWebAddress('https://bank.example@evil.example/login')).toBeNull();
    expect(publicWebAddress('https://user:pass@example.com')).toBeNull();
  });
});

describe('What a bar stores', () => {
  it('the headline tidied, the link made whole, the button as picked', () => {
    expect(ctaColumns({ label: 'BOOK_NOW', url: 'example.com/book', headline: '  Book a   session  ' })).toEqual({
      ctaLabel: 'BOOK_NOW', ctaUrl: 'https://example.com/book', ctaHeadline: 'Book a session',
    });
    expect(ctaColumns(undefined)).toEqual({});
  });

  it('refuses a bar missing its words, too long, with a made-up button, or going nowhere safe', () => {
    expect(() => ctaColumns({ label: 'LEARN_MORE', url: 'https://example.com', headline: '   ' })).toThrow(/headline/);
    expect(() => ctaColumns({ label: 'LEARN_MORE', url: 'https://example.com', headline: 'x'.repeat(201) })).toThrow(/200/);
    expect(() => ctaColumns({ label: 'CLICK_HERE' as never, url: 'https://example.com', headline: 'Hi' })).toThrow(/from the list/);
    expect(() => ctaColumns({ label: 'LEARN_MORE', url: 'http://localhost', headline: 'Hi' })).toThrow(/public web address/);
  });
});

describe('A bar where it does not belong', () => {
  const service = () => {
    const create = jest.fn();
    const svc = Object.assign(Object.create(PostsService.prototype), {
      prisma: { post: { create } },
      media: { assertPostMedia: jest.fn().mockResolvedValue(undefined) },
      collaborators: { check: jest.fn().mockResolvedValue([]) },
      polls: {},
    }) as PostsService;
    return { svc, create };
  };
  const cta = { label: 'LEARN_MORE' as const, url: 'https://example.com', headline: 'Read more' };

  it('is refused on a poll, and beside a linked listing — before anything is written', async () => {
    const poll = service();
    await expect(poll.svc.create('author', { content: 'Which?', poll: { options: ['A', 'B'] }, cta })).rejects.toBeInstanceOf(BadRequestException);
    expect(poll.create).not.toHaveBeenCalled();
    // A listing's own checks run first; the bar's rule is the one that refuses it here.
    const ctaFor = (dto: object) => (service().svc as unknown as { ctaFor: (d: object) => unknown }).ctaFor(dto);
    expect(() => ctaFor({ content: 'Hiring', reference: { type: 'job', id: POST }, cta })).toThrow(/already links/);
    expect(ctaFor({ content: 'Launch', cta })).toEqual({ ctaLabel: 'LEARN_MORE', ctaUrl: 'https://example.com/', ctaHeadline: 'Read more' });
  });
});

describe('Counting button clicks', () => {
  const stats = (post: Record<string, unknown> | null, inserted: unknown[] = [{ post_id: POST }], seat: unknown = null) => {
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue(post) },
      companyMember: { findFirst: jest.fn().mockResolvedValue(seat) },
      $queryRaw: jest.fn().mockResolvedValue(inserted),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    return { svc: new PostStatsService(prisma as never), prisma };
  };
  const withButton = { id: POST, authorId: 'author', companyId: null, removedAt: null, ctaUrl: 'https://example.com/' };

  it("counts a reader's first press of the day, and adds it to the post", async () => {
    const { svc, prisma } = stats(withButton);
    await expect(svc.recordCtaClick(READER, POST)).resolves.toEqual({ counted: true });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('a second press the same day changes nothing', async () => {
    const { svc, prisma } = stats(withButton, []);
    await expect(svc.recordCtaClick(READER, POST)).resolves.toEqual({ counted: false });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("never the author's own press, the company team's, or a post with no button", async () => {
    const own = stats(withButton);
    await expect(own.svc.recordCtaClick(AUTHOR, POST)).resolves.toEqual({ counted: false });
    expect(own.prisma.$queryRaw).not.toHaveBeenCalled();

    const team = stats({ ...withButton, companyId: 'acme' }, [{ post_id: POST }], { id: 'seat' });
    await expect(team.svc.recordCtaClick(READER, POST)).resolves.toEqual({ counted: false });
    expect(team.prisma.$queryRaw).not.toHaveBeenCalled();

    const none = stats({ ...withButton, ctaUrl: null });
    await expect(none.svc.recordCtaClick(READER, POST)).resolves.toEqual({ counted: false });
  });
});
