import { ProviderAvatarService } from '../../../src/auth/provider-avatar.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PROFILE_BUCKET, StorageService } from '../../../src/storage/storage.service';

const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocPhoto=s96-c';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const OWN = 'https://x.supabase.co/storage/v1/object/public/profile-media/avatars/u1-provider-1.jpg';

function harness(changed = 1) {
  const prisma = { user: { updateMany: jest.fn().mockResolvedValue({ count: changed }) } };
  const storage = {
    uploadPublicFile: jest.fn().mockResolvedValue(OWN),
    deletePublicFile: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ProviderAvatarService(prisma as unknown as PrismaService, storage as unknown as StorageService);
  return { service, prisma, storage };
}

const respond = (body: Buffer, status = 200) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array(body), { status }));

/** Lets the background copy run to completion. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => jest.restoreAllMocks());

describe('ProviderAvatarService', () => {
  it.each([
    [GOOGLE, true],
    ['https://lh5.googleusercontent.com/-abc/photo.jpg', true],
    ['http://lh3.googleusercontent.com/a/x', false],
    ['https://googleusercontent.com.evil.example/a/x', false],
    ['https://x.supabase.co/storage/v1/object/public/profile-media/avatars/u1-1.jpg', false],
    ['not a url', false],
    [null, false],
  ])('treats %s as provider-hosted: %s', (url, expected) => {
    expect(harness().service.isProviderHosted(url)).toBe(expected);
  });

  it('copies the photo at a usable size and points the account at the copy', async () => {
    const { service, prisma, storage } = harness();
    const fetch = respond(JPEG);

    service.mirrorInBackground('u1', GOOGLE);
    await settle();

    expect(fetch).toHaveBeenCalledWith('https://lh3.googleusercontent.com/a/ACg8ocPhoto=s400-c', expect.anything());
    expect(storage.uploadPublicFile).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/u1-provider-\d+\.jpg$/),
      JPEG,
      'image/jpeg',
      PROFILE_BUCKET,
    );
    // Only while the account still shows the photo that was copied.
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u1', avatarUrl: GOOGLE }, data: { avatarUrl: OWN } });
    expect(storage.deletePublicFile).not.toHaveBeenCalled();
  });

  it('throws the copy away when the photo changed meanwhile', async () => {
    const { service, storage } = harness(0);
    respond(JPEG);

    service.mirrorInBackground('u1', GOOGLE);
    await settle();

    const [path] = storage.uploadPublicFile.mock.calls[0];
    expect(storage.deletePublicFile).toHaveBeenCalledWith(path, PROFILE_BUCKET);
  });

  it('never fetches an address outside the provider host', async () => {
    const { service } = harness();
    const fetch = respond(JPEG);

    service.mirrorInBackground('u1', 'https://169.254.169.254/latest/meta-data');
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores nothing that is not an image, and does not throw', async () => {
    const { service, storage, prisma } = harness();
    respond(Buffer.from('<html>nope</html>'));

    service.mirrorInBackground('u1', GOOGLE);
    await settle();

    expect(storage.uploadPublicFile).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('leaves the provider photo in place when the host refuses', async () => {
    const { service, storage } = harness();
    respond(Buffer.alloc(0), 429);

    service.mirrorInBackground('u1', GOOGLE);
    await settle();

    expect(storage.uploadPublicFile).not.toHaveBeenCalled();
  });

  it('copies once while several sign-in requests arrive together', async () => {
    const { service } = harness();
    const fetch = respond(JPEG);

    service.mirrorInBackground('u1', GOOGLE);
    service.mirrorInBackground('u1', GOOGLE);
    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
