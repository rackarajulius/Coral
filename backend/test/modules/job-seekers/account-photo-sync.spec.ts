import { JobSeekersService } from '../../../src/job-seekers/job-seekers.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PROFILE_BUCKET, StorageService } from '../../../src/storage/storage.service';

const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/profile-media/';
const file = { mimetype: 'image/png', buffer: Buffer.from('png') } as Express.Multer.File;

function harness(profileAvatar: string | null, accountAvatar: string | null) {
  const tx = {
    user: { update: jest.fn().mockResolvedValue({}) },
    jobSeekerProfile: { update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'p1', ...data })) },
  };
  const prisma = {
    jobSeekerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1', avatarUrl: profileAvatar }) },
    user: { findUnique: jest.fn().mockResolvedValue({ avatarUrl: accountAvatar }) },
    $transaction: jest.fn().mockImplementation((work) => work(tx)),
  };
  const storage = {
    uploadPublicFile: jest.fn().mockResolvedValue(`${PUBLIC}avatars/u1-2.png`),
    deletePublicFile: jest.fn().mockResolvedValue(undefined),
    pathFromPublicUrl: StorageService.prototype.pathFromPublicUrl,
  };
  const service = new JobSeekersService(
    prisma as unknown as PrismaService,
    {} as never,
    storage as unknown as StorageService,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, tx, storage };
}

describe('job-seeker photo is the account photo', () => {
  it('an upload becomes the account photo too, and the replaced copies are deleted', async () => {
    const { service, tx, storage } = harness(`${PUBLIC}avatars/u1-1.png`, `${PUBLIC}avatars/u1-provider-1.jpg`);

    await service.uploadAvatar('u1', file);

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { avatarUrl: `${PUBLIC}avatars/u1-2.png` } });
    expect(tx.jobSeekerProfile.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { avatarUrl: `${PUBLIC}avatars/u1-2.png` } });
    expect(storage.deletePublicFile.mock.calls).toEqual([
      ['avatars/u1-1.png', PROFILE_BUCKET],
      ['avatars/u1-provider-1.jpg', PROFILE_BUCKET],
    ]);
  });

  it('removing the photo removes the sign-in photo as well', async () => {
    const { service, tx } = harness(null, 'https://lh3.googleusercontent.com/a/x=s96-c');

    await service.deleteAvatar('u1');

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { avatarUrl: null } });
    expect(tx.jobSeekerProfile.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { avatarUrl: null } });
  });

  it("never deletes someone else's file named as the account photo", async () => {
    const { service, storage } = harness(null, `${PUBLIC}avatars/someone-else-1.png`);

    await service.uploadAvatar('u1', file);

    expect(storage.deletePublicFile).not.toHaveBeenCalled();
  });
});
