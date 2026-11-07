import { ForbiddenException } from '@nestjs/common';
import { PostsService } from '../../../src/community/posts/posts.service';
import { User } from '../../../src/common/types/user.types';

/**
 * Deleting your own post takes its video with it, at Mux, straight away —
 * not a day later when the sweep finds it unused.
 */

const AUTHOR = { id: 'author', role: 'JOB_SEEKER' } as User;
const STREAM = 'https://stream.mux.com/PB123.m3u8';
const PICTURE = 'https://x.supabase.co/storage/v1/object/public/community-media/posts/author/a.png';

function service(mediaUrls: string[], deleteForUrls = jest.fn().mockResolvedValue(undefined)) {
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'author', companyId: null, mediaUrls }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const svc = Object.assign(Object.create(PostsService.prototype), { prisma, media: { deleteForUrls } }) as PostsService;
  return { svc, prisma, deleteForUrls };
}

describe("Deleting a post with a video", () => {
  it('deletes the video from Mux too — only the stream; pictures keep their own sweep', async () => {
    const { svc, prisma, deleteForUrls } = service([STREAM]);
    await expect(svc.delete('p1', AUTHOR)).resolves.toMatchObject({ success: true });
    expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(deleteForUrls).toHaveBeenCalledWith([STREAM]);

    const pictures = service([PICTURE]);
    await pictures.svc.delete('p1', AUTHOR);
    expect(pictures.deleteForUrls).not.toHaveBeenCalled();
  });

  it('never fails the delete when Mux does not answer', async () => {
    const { svc, prisma } = service([STREAM], jest.fn().mockRejectedValue(new Error('Mux down')));
    await expect(svc.delete('p1', AUTHOR)).resolves.toMatchObject({ success: true });
    expect(prisma.post.delete).toHaveBeenCalled();
  });

  it("touches nothing for someone who may not delete it", async () => {
    const { svc, prisma, deleteForUrls } = service([STREAM]);
    await expect(svc.delete('p1', { id: 'someone-else', role: 'JOB_SEEKER' } as User)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.delete).not.toHaveBeenCalled();
    expect(deleteForUrls).not.toHaveBeenCalled();
  });
});
