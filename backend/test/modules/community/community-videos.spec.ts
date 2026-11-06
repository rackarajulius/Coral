import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CommunityVideoStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import { CommunityVideosService, MAX_VIDEO_SECONDS } from '../../../src/community/videos/community-videos.service';
import { MuxClient } from '../../../src/community/videos/mux.client';
import { CommunityMediaService } from '../../../src/community/media.service';
import { playbackIdOf, posterUrlFor, streamUrlFor } from '../../../src/community/videos/stream-url';

/**
 * Long community videos: the browser sends them to Mux, and only what Mux
 * reports — read by the server — makes one postable.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const ME = 'me';
const SOMEONE = 'someone-else';
const HOUR = 60 * 60 * 1000;

type Row = {
  id: string; ownerId: string | null; muxUploadId: string; muxAssetId: string | null; playbackId: string | null;
  status: CommunityVideoStatus; durationSeconds: number | null; aspectRatio: string | null; failureReason: string | null;
  createdAt: Date; updatedAt: Date;
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'v1', ownerId: ME, muxUploadId: 'up1', muxAssetId: null, playbackId: null,
    status: CommunityVideoStatus.UPLOADING, durationSeconds: null, aspectRatio: null, failureReason: null,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

function harness(opts: { enabled?: boolean; rows?: Row[]; postsShowing?: string[]; queuedShowing?: string[] } = {}) {
  const rows = new Map((opts.rows ?? []).map((r) => [r.id, { ...r }]));
  const config = { get: jest.fn((key: string) => ({ FRONTEND_URL: 'http://localhost:8081/', MUX_WEBHOOK_SECRET: 'whsec' } as Record<string, string>)[key]) };
  const mux = {
    enabled: opts.enabled ?? true,
    createUpload: jest.fn().mockResolvedValue({ id: 'up-new', url: 'https://storage.googleapis.com/upload?sig=1', status: 'waiting' }),
    getUpload: jest.fn().mockResolvedValue({ id: 'up1', status: 'waiting' }),
    getAsset: jest.fn(),
    deleteAsset: jest.fn().mockResolvedValue(undefined),
    cancelUpload: jest.fn().mockResolvedValue(undefined),
    verifyWebhook: jest.fn().mockReturnValue(true),
  };
  const prisma = {
    communityVideo: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => { const r = row(data); rows.set(r.id, r); return r; }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => rows.get(where.id) ?? null),
      findFirst: jest.fn().mockImplementation(async ({ where }) => [...rows.values()].find((r) =>
        where.OR.some((w: Partial<Row>) => Object.entries(w).every(([k, v]) => r[k as keyof Row] === v))) ?? null),
      findMany: jest.fn().mockImplementation(async ({ where, cursor }) => {
        if (where?.playbackId) return [...rows.values()].filter((r) => where.playbackId.in.includes(r.playbackId));
        return cursor ? [] : [...rows.values()];
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => { const r = { ...rows.get(where.id)!, ...data }; rows.set(r.id, r); return r; }),
      delete: jest.fn().mockImplementation(async ({ where }) => { rows.delete(where.id); return {}; }),
    },
    post: { count: jest.fn().mockImplementation(async ({ where }) => (opts.postsShowing ?? []).includes(where.mediaUrls.has) ? 1 : 0) },
    scheduledPost: { count: jest.fn().mockImplementation(async ({ where }) => (opts.queuedShowing ?? []).includes(where.payload.array_contains[0]) ? 1 : 0) },
  };
  const service = new CommunityVideosService(collaborator(prisma), collaborator(mux), collaborator(config));
  return { service, prisma, mux, rows };
}

describe('Starting a video upload', () => {
  it('is refused, plainly, until Mux is set up', async () => {
    const { service } = harness({ enabled: false });
    expect(service.status()).toEqual({ enabled: false, maxSeconds: MAX_VIDEO_SECONDS });
    await expect(service.start(ME)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("asks Mux for an upload for this site's browser, matched back to our row", async () => {
    const { service, mux, prisma } = harness();
    const result = await service.start(ME);
    const { passthrough, corsOrigin } = mux.createUpload.mock.calls[0][0];
    expect(corsOrigin).toBe('http://localhost:8081');
    expect(result).toEqual({ id: passthrough, uploadUrl: 'https://storage.googleapis.com/upload?sig=1' });
    expect(prisma.communityVideo.create).toHaveBeenCalledWith({ data: { id: passthrough, ownerId: ME, muxUploadId: 'up-new' } });
  });

  it('keeps to a few at a time and a day’s worth', async () => {
    const { service, prisma, mux } = harness();
    prisma.communityVideo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    await expect(service.start(ME)).rejects.toThrow('3 videos at a time');
    prisma.communityVideo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(20);
    await expect(service.start(ME)).rejects.toThrow('up to 20 videos a day');
    expect(mux.createUpload).not.toHaveBeenCalled();
  });
});

describe('Where a video got to', () => {
  it('is read from Mux: received, then ready to stream at its own address', async () => {
    const { service, mux } = harness({ rows: [row()] });
    mux.getUpload.mockResolvedValue({ id: 'up1', status: 'asset_created', asset_id: 'asset1' });
    mux.getAsset.mockResolvedValueOnce({ id: 'asset1', status: 'preparing' });
    await expect(service.get(ME, 'v1')).resolves.toMatchObject({ status: 'processing', url: null });

    mux.getAsset.mockResolvedValueOnce({
      id: 'asset1', status: 'ready', duration: 312.4, aspect_ratio: '9:16', playback_ids: [{ id: 'PB123', policy: 'public' }],
    });
    await expect(service.get(ME, 'v1')).resolves.toEqual({
      id: 'v1', status: 'ready', url: 'https://stream.mux.com/PB123.m3u8', posterUrl: posterUrlFor('PB123'),
      durationSeconds: 312.4, aspectRatio: '9:16', failureReason: null,
    });
  });

  it('turns away a video over ten minutes, and deletes it from Mux', async () => {
    const { service, mux } = harness({ rows: [row({ status: CommunityVideoStatus.PROCESSING, muxAssetId: 'asset1' })] });
    mux.getAsset.mockResolvedValue({ id: 'asset1', status: 'ready', duration: 754, playback_ids: [{ id: 'PB', policy: 'public' }] });
    await expect(service.get(ME, 'v1')).resolves.toMatchObject({
      status: 'failed', url: null, failureReason: 'That video is 12:34 long. Videos can be up to 10:00.',
    });
    expect(mux.deleteAsset).toHaveBeenCalledWith('asset1');
  });

  it('allows a recording of exactly ten minutes, which Mux measures a hair over', async () => {
    const { service, mux } = harness({ rows: [row({ status: CommunityVideoStatus.PROCESSING, muxAssetId: 'asset1' })] });
    mux.getAsset.mockResolvedValue({ id: 'asset1', status: 'ready', duration: 600.04, playback_ids: [{ id: 'PB', policy: 'public' }] });
    await expect(service.get(ME, 'v1')).resolves.toMatchObject({ status: 'ready' });
  });

  it("says what to do when Mux can't read the file, or the upload never finished", async () => {
    const bad = harness({ rows: [row({ status: CommunityVideoStatus.PROCESSING, muxAssetId: 'asset1' })] });
    bad.mux.getAsset.mockResolvedValue({ id: 'asset1', status: 'errored', errors: { type: 'invalid_input' } });
    await expect(bad.service.get(ME, 'v1')).resolves.toMatchObject({ status: 'failed', failureReason: expect.stringContaining('Export it as MP4') });

    const late = harness({ rows: [row()] });
    late.mux.getUpload.mockResolvedValue({ id: 'up1', status: 'timed_out' });
    await expect(late.service.get(ME, 'v1')).resolves.toMatchObject({ status: 'failed', failureReason: expect.stringContaining('in time') });
  });

  it("is nobody else's business", async () => {
    const { service } = harness({ rows: [row()] });
    await expect(service.get(SOMEONE, 'v1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.discard(SOMEONE, 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('A post naming a video', () => {
  const ready = row({ status: CommunityVideoStatus.READY, muxAssetId: 'asset1', playbackId: 'PB1' });

  it("only takes its author's own video, once it streams", async () => {
    const { service, rows } = harness({ rows: [ready] });
    await expect(service.assertUsable(ME, [streamUrlFor('PB1')])).resolves.toBeUndefined();
    await expect(service.assertUsable(SOMEONE, [streamUrlFor('PB1')])).rejects.toThrow('by you');
    await expect(service.assertUsable(ME, [streamUrlFor('NOTOURS')])).rejects.toThrow('by you');
    rows.set('v1', { ...ready, status: CommunityVideoStatus.PROCESSING });
    await expect(service.assertUsable(ME, [streamUrlFor('PB1')])).rejects.toThrow('not ready');
  });

  it('shows it on its own, one per post, and still checks every other file', async () => {
    const { service: videos } = harness({ rows: [ready] });
    const media = new CommunityMediaService(collaborator({}), collaborator({}), videos);
    const picture = 'https://x.supabase.co/storage/v1/object/public/community-media/posts/me/a.png';
    await expect(media.assertPostMedia(ME, [streamUrlFor('PB1')])).resolves.toBeUndefined();
    await expect(media.assertPostMedia(ME, [streamUrlFor('PB1'), picture])).rejects.toThrow('on its own');
    await expect(media.assertPostMedia(ME, [streamUrlFor('PB1'), streamUrlFor('PB2')])).rejects.toThrow('one video');
    await expect(media.assertPostMedia(ME, ['https://evil.example/pixel.png'])).rejects.toBeInstanceOf(BadRequestException);
    // A look-alike address is not a stream, and so not one of ours.
    expect(playbackIdOf('https://stream.mux.com.evil.example/PB1.m3u8')).toBeNull();
    await expect(media.assertPostMedia(ME, ['https://stream.mux.com.evil.example/PB1.m3u8'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('can be taken out of a draft, but not out from under a post', async () => {
    const shown = harness({ rows: [ready], postsShowing: [streamUrlFor('PB1')] });
    await expect(shown.service.discard(ME, 'v1')).rejects.toThrow('Delete the post');
    expect(shown.mux.deleteAsset).not.toHaveBeenCalled();

    const draft = harness({ rows: [ready] });
    await expect(draft.service.discard(ME, 'v1')).resolves.toEqual({ id: 'v1', deleted: true });
    expect(draft.mux.deleteAsset).toHaveBeenCalledWith('asset1');
    expect(draft.rows.has('v1')).toBe(false);
  });

  it("goes from Mux when a moderator removes the post", async () => {
    const { service, mux, rows } = harness({ rows: [ready] });
    await service.deleteForUrls([streamUrlFor('PB1'), 'https://x.supabase.co/storage/v1/object/public/community-media/posts/me/a.png']);
    expect(mux.deleteAsset).toHaveBeenCalledWith('asset1');
    expect(rows.size).toBe(0);
  });
});

describe('Keeping only what is shown', () => {
  it('deletes old unused videos, unfinished uploads and those of closed accounts; keeps what posts show', async () => {
    const old = new Date(Date.now() - 30 * HOUR);
    const { service, mux, rows } = harness({
      rows: [
        row({ id: 'shown', status: CommunityVideoStatus.READY, muxAssetId: 'a-shown', playbackId: 'SHOWN', createdAt: old }),
        row({ id: 'queued', status: CommunityVideoStatus.READY, muxAssetId: 'a-queued', playbackId: 'QUEUED', createdAt: old }),
        row({ id: 'unused', status: CommunityVideoStatus.READY, muxAssetId: 'a-unused', playbackId: 'UNUSED', createdAt: old }),
        row({ id: 'abandoned', muxUploadId: 'up-abandoned', createdAt: old }),
        row({ id: 'gone', ownerId: null, status: CommunityVideoStatus.READY, muxAssetId: 'a-gone', playbackId: 'GONE' }),
      ],
      postsShowing: [streamUrlFor('SHOWN')],
      queuedShowing: [streamUrlFor('QUEUED')],
    });
    mux.deleteAsset.mockImplementationOnce(async () => { throw new Error('Mux down'); });
    await service.sweep();
    expect([...rows.keys()].sort()).toEqual(['queued', 'shown', 'unused']);
    expect(mux.cancelUpload).toHaveBeenCalledWith('up-abandoned');
    expect(mux.deleteAsset).toHaveBeenCalledWith('a-gone');
    // The one that failed is tried again next hour.
    expect(mux.deleteAsset).toHaveBeenCalledWith('a-unused');
  });
});

describe("Mux's webhook", () => {
  it('is acted on only when signed, and then by asking Mux', async () => {
    const { service, mux } = harness({ rows: [row()] });
    mux.verifyWebhook.mockReturnValueOnce(false);
    await expect(service.handleWebhook('{}', 't=1,v1=x')).rejects.toThrow('Invalid signature');

    mux.getUpload.mockResolvedValue({ id: 'up1', status: 'asset_created', asset_id: 'asset1' });
    mux.getAsset.mockResolvedValue({ id: 'asset1', status: 'preparing' });
    const body = JSON.stringify({ type: 'video.upload.asset_created', data: { id: 'up1', asset_id: 'asset1', new_asset_settings: { passthrough: 'v1' } } });
    await expect(service.handleWebhook(body, 'sig')).resolves.toEqual({ received: true });
    expect(mux.getUpload).toHaveBeenCalledWith('up1');
  });

  it('checks the signature the way Mux signs: HMAC-SHA256 of "t.body", within five minutes', () => {
    const client = new MuxClient(collaborator({ get: (key: string) => (key === 'MUX_WEBHOOK_SECRET' ? 'whsec' : undefined) }));
    const body = '{"type":"video.asset.ready"}';
    const t = 1_800_000_000;
    const v1 = createHmac('sha256', 'whsec').update(`${t}.${body}`).digest('hex');
    expect(client.verifyWebhook(body, `t=${t},v1=${v1}`, t * 1000)).toBe(true);
    expect(client.verifyWebhook(body + ' ', `t=${t},v1=${v1}`, t * 1000)).toBe(false);
    expect(client.verifyWebhook(body, `t=${t},v1=${v1}`, (t + 301) * 1000)).toBe(false);
    expect(client.verifyWebhook(body, undefined, t * 1000)).toBe(false);
  });
});
