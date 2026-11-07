import { BadRequestException } from '@nestjs/common';
import { PostsService } from '../../../src/community/posts/posts.service';

/**
 * The "New posts" button asks how many posts a feed has gained since the
 * newest one the reader has. It must count by the feed's own rules, or the
 * button would promise posts the feed then doesn't show.
 */

function service() {
  const count = jest.fn().mockResolvedValue(3);
  const svc = Object.assign(Object.create(PostsService.prototype), { prisma: { post: { count } } }) as PostsService;
  return { svc, count };
}

const AFTER = '2026-11-08T10:00:00.000Z';

describe('Counting new posts for the "New posts" button', () => {
  it('counts only what the feed itself would show, newer than the newest the reader has', async () => {
    const { svc, count } = service();
    await expect(svc.countNewer({ section: 'showcase', spaceId: '11111111-1111-4111-8111-111111111111' }, AFTER)).resolves.toEqual({ count: 3 });
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        removedAt: null,
        spaceId: '11111111-1111-4111-8111-111111111111',
        purpose: { in: expect.any(Array) },
        createdAt: { gt: new Date(AFTER) },
      }),
    });
  });

  it("keeps a personal slice the reader's own, and has nothing to count for someone signed out", async () => {
    const { svc, count } = service();
    await svc.countNewer({ filter: 'mine' }, AFTER, 'me');
    expect(count.mock.calls[0][0].where).toEqual(expect.objectContaining({ authorId: 'me' }));
    await expect(svc.countNewer({ filter: 'mine' }, AFTER)).resolves.toEqual({ count: 0 });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('refuses a time it cannot read', async () => {
    const { svc } = service();
    await expect(svc.countNewer({}, 'not a date')).rejects.toBeInstanceOf(BadRequestException);
  });
});
