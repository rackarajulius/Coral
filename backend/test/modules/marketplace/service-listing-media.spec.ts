import { BadRequestException } from '@nestjs/common';
import { assertListingMedia, ownListingMedia } from '../../../src/marketplace/marketplace-policy';
import { MarketplaceService } from '../../../src/marketplace/marketplace.service';
import { MarketplaceModerationService } from '../../../src/marketplace/marketplace-moderation.service';
import { VideoPreviewService } from '../../../src/marketplace/video-preview.service';
import { COMMUNITY_BUCKET } from '../../../src/storage/storage.service';

/**
 * Pictures and a video on a service listing, and preview cards for video
 * work samples.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STORAGE = `https://example.supabase.co/storage/v1/object/public/${COMMUNITY_BUCKET}`;
const file = (owner: string, n: number, ext: string) => `${STORAGE}/posts/${owner}/00000000-0000-4000-8000-00000000000${n}.${ext}`;

describe('Which pictures and video a service can show', () => {
  it("its owner's own uploads: up to 8 pictures and one video", () => {
    const pictures = Array.from({ length: 8 }, (_, i) => file(OWNER, i, 'jpg'));
    expect(() => assertListingMedia([...pictures, file(OWNER, 9, 'mp4')], OWNER)).not.toThrow();
    expect(() => assertListingMedia([], OWNER)).not.toThrow();
  });

  it("nothing from another site, nor someone else's uploads", () => {
    expect(() => assertListingMedia(['https://evil.example/cat.jpg'], OWNER)).toThrow(BadRequestException);
    expect(() => assertListingMedia([file(OTHER, 1, 'jpg')], OWNER)).toThrow('uploaded here, by the listing owner');
    expect(ownListingMedia(`${STORAGE}/posts/${OWNER}/report.pdf`, OWNER)).toBeNull();
  });

  it('one video, eight pictures, each once', () => {
    expect(() => assertListingMedia([file(OWNER, 1, 'mp4'), file(OWNER, 2, 'webm')], OWNER)).toThrow('one video');
    expect(() => assertListingMedia(Array.from({ length: 9 }, (_, i) => file(OWNER, i, 'png')), OWNER)).toThrow('8 pictures');
    expect(() => assertListingMedia([file(OWNER, 1, 'jpg'), file(OWNER, 1, 'jpg')], OWNER)).toThrow('once');
  });

  it('is refused before anything is written', async () => {
    const before = process.env.MARKETPLACE_LISTING_WRITES_ENABLED;
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true';
    try {
      const prisma = { $transaction: jest.fn() };
      const service = new MarketplaceService(collaborator(prisma));
      await expect(service.create('service', OWNER, { title: 'Logos', mediaUrls: [file(OTHER, 1, 'jpg')] }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      process.env.MARKETPLACE_LISTING_WRITES_ENABLED = before;
    }
  });
});

describe('Video work samples', () => {
  const storage = { uploadPublicFile: jest.fn().mockImplementation(async (path: string) => `${STORAGE}/${path}`) };
  const videos = new VideoPreviewService(collaborator(storage));
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; storage.uploadPublicFile.mockClear(); });

  it('asks YouTube and Vimeo only, at their own fixed addresses', () => {
    expect(videos.oembedFor('https://www.youtube.com/watch?v=abc')?.endpoint).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?/);
    expect(videos.oembedFor('https://youtu.be/abc')?.siteName).toBe('YouTube');
    expect(videos.oembedFor('https://vimeo.com/123')?.endpoint).toMatch(/^https:\/\/vimeo\.com\/api\/oembed\.json\?/);
    expect(videos.oembedFor('https://example.com/video')).toBeNull();
    expect(videos.oembedFor('http://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('keeps our own copy of the thumbnail, never the video site’s address', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'Brand film', thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' }) })
      .mockResolvedValueOnce({ ok: true, headers: new Map(), arrayBuffer: async () => jpeg }) as unknown as typeof fetch;
    const preview = await videos.preview('https://www.youtube.com/watch?v=abc', OWNER);
    expect(preview).toEqual({ title: 'Brand film', siteName: 'YouTube', imageUrl: expect.stringContaining(`/link-previews/${OWNER}/`) });
  });

  it('fetches no thumbnail from anywhere else', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'x', thumbnail_url: 'https://tracker.example/pixel.jpg' }) }) as unknown as typeof fetch;
    const preview = await videos.preview('https://vimeo.com/123', OWNER);
    expect(preview?.imageUrl).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('A removed service loses its pictures', () => {
  function harness(mediaUrls: string[]) {
    const tx = {
      $queryRaw: jest.fn(),
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' }) },
      serviceListing: { findUnique: jest.fn().mockResolvedValue({ id: 'svc', mediaUrls }), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const storage = { deletePublicFile: jest.fn() };
    return { service: new MarketplaceModerationService(collaborator(prisma), collaborator(storage)), tx, storage };
  }

  it('deletes the files once the removal is recorded', async () => {
    const { service, storage } = harness([file(OWNER, 1, 'jpg'), file(OWNER, 2, 'mp4')]);
    await service.setRemoval('admin', 'service', 'svc', true, 'Spam pictures');
    expect(storage.deletePublicFile).toHaveBeenCalledWith(`posts/${OWNER}/00000000-0000-4000-8000-000000000001.jpg`, COMMUNITY_BUCKET);
    expect(storage.deletePublicFile).toHaveBeenCalledTimes(2);
  });

  it('comes back without them when restored', async () => {
    const { service, tx, storage } = harness([]);
    await service.setRemoval('admin', 'service', 'svc', false);
    expect(tx.serviceListing.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ removedAt: null, mediaUrls: [] }) }));
    expect(storage.deletePublicFile).not.toHaveBeenCalled();
  });
});
