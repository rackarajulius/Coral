import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';
import { CommunityVideo, CommunityVideoStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ExclusiveCron } from '../../common/scheduling/exclusive-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { MuxClient } from './mux.client';
import { playbackIdOf, posterUrlFor, streamUrlFor } from './stream-url';

/** Ten minutes: LinkedIn's limit for a video posted from a phone. */
export const MAX_VIDEO_SECONDS = 600;
/** Mux reports a 10:00 recording as 600.02 and the like. */
const DURATION_SLACK_SECONDS = 1;
/** Uploads one person can have going at once. */
const MAX_IN_FLIGHT = 3;
/** Videos one person can start in a day. Each costs us storage and encoding time. */
const MAX_PER_DAY = 20;
/** How long a video may sit unused before the sweep deletes it. */
const UNUSED_GRACE_MS = 24 * 60 * 60 * 1000;

/** What the composer is told about a video. */
export interface VideoView {
  id: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  /** What a post names it by, once it streams. */
  url: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  failureReason: string | null;
}

/**
 * Videos for community posts, longer than our storage can sensibly hold:
 * sent by the browser straight to Mux, which streams them at whatever quality
 * the reader's connection can take.
 *
 * Nothing about a video is taken from the browser. Where it got to is always
 * read from Mux — when the composer asks, and when Mux's webhook says
 * something changed — and only the server decides it is READY, after checking
 * its length. A post can name a video only by the stream URL of its author's
 * own READY video.
 */
@Injectable()
export class CommunityVideosService {
  private readonly logger = new Logger(CommunityVideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mux: MuxClient,
    private readonly config: ConfigService,
  ) {}

  status() {
    return { enabled: this.mux.enabled, maxSeconds: MAX_VIDEO_SECONDS };
  }

  /** An upload URL for one video, and the id to ask about it by. */
  async start(userId: string): Promise<{ id: string; uploadUrl: string }> {
    if (!this.mux.enabled) throw new ServiceUnavailableException('Video uploads are not set up yet.');

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [inFlight, today] = await Promise.all([
      this.prisma.communityVideo.count({
        where: { ownerId: userId, status: { in: [CommunityVideoStatus.UPLOADING, CommunityVideoStatus.PROCESSING] }, createdAt: { gte: dayAgo } },
      }),
      this.prisma.communityVideo.count({ where: { ownerId: userId, createdAt: { gte: dayAgo } } }),
    ]);
    if (inFlight >= MAX_IN_FLIGHT) {
      throw new BadRequestException(`You can upload ${MAX_IN_FLIGHT} videos at a time. Wait for one to finish.`);
    }
    if (today >= MAX_PER_DAY) {
      throw new BadRequestException(`You can upload up to ${MAX_PER_DAY} videos a day. Try again tomorrow.`);
    }

    // Our id goes to Mux with the upload, so its webhook can be matched back.
    const id = randomUUID();
    const corsOrigin = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:8081').replace(/\/$/, '');
    const upload = await this.mux.createUpload({ corsOrigin, passthrough: id });
    try {
      await this.prisma.communityVideo.create({ data: { id, ownerId: userId, muxUploadId: upload.id } });
    } catch (err) {
      await this.mux.cancelUpload(upload.id).catch(() => undefined);
      throw err;
    }
    return { id, uploadUrl: upload.url };
  }

  /** Where your video got to. Asks Mux when it isn't settled yet. */
  async get(userId: string, id: string): Promise<VideoView> {
    const video = await this.owned(userId, id);
    return this.view(await this.refresh(video));
  }

  /** Removed from the draft: deleted from Mux, unless a post already shows it. */
  async discard(userId: string, id: string): Promise<{ id: string; deleted: true }> {
    const video = await this.owned(userId, id);
    if (await this.inUse(video)) {
      throw new BadRequestException('A post shows this video. Delete the post to remove it.');
    }
    await this.destroy(video);
    return { id, deleted: true };
  }

  /**
   * Mux saying something changed. Only a signed call is acted on, and even
   * then the news is read from Mux's API rather than from the call itself.
   */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<{ received: boolean }> {
    if (!this.mux.verifyWebhook(rawBody, signature)) throw new BadRequestException('Invalid signature');
    let event: { type?: string; data?: { id?: string; upload_id?: string; passthrough?: string; new_asset_settings?: { passthrough?: string } } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid payload');
    }
    if (!event.type?.startsWith('video.')) return { received: true };
    const data = event.data ?? {};
    const ourId = data.passthrough ?? data.new_asset_settings?.passthrough;
    const where: Prisma.CommunityVideoWhereInput[] = [
      ...(ourId ? [{ id: ourId }] : []),
      ...(data.id ? [{ muxUploadId: data.id }, { muxAssetId: data.id }] : []),
      ...(data.upload_id ? [{ muxUploadId: data.upload_id }] : []),
    ];
    if (where.length === 0) return { received: true };
    const video = await this.prisma.communityVideo.findFirst({ where: { OR: where } });
    if (video) await this.refresh(video);
    return { received: true };
  }

  /**
   * The stream URLs a post may carry: each the author's own video, ready to
   * play. Anything else is refused before the post exists.
   */
  async assertUsable(userId: string, urls: string[]): Promise<void> {
    const playbackIds = urls.map(playbackIdOf);
    if (playbackIds.some((id) => !id)) throw new BadRequestException('Videos have to be uploaded here.');
    const videos = await this.prisma.communityVideo.findMany({
      where: { playbackId: { in: playbackIds as string[] } },
      select: { playbackId: true, ownerId: true, status: true },
    });
    for (const playbackId of playbackIds) {
      const video = videos.find((v) => v.playbackId === playbackId);
      if (!video || video.ownerId !== userId) throw new BadRequestException('Videos have to be uploaded here, by you.');
      if (video.status !== CommunityVideoStatus.READY) throw new BadRequestException('That video is not ready to post yet.');
    }
  }

  /** A removed post's videos: deleted from Mux, so the stream stops existing. */
  async deleteForUrls(urls: string[]): Promise<void> {
    const playbackIds = urls.map(playbackIdOf).filter((id): id is string => !!id);
    if (playbackIds.length === 0) return;
    const videos = await this.prisma.communityVideo.findMany({ where: { playbackId: { in: playbackIds } } });
    for (const video of videos) {
      await this.destroy(video).catch((err) => this.logger.warn(`Could not delete video ${video.id}: ${(err as Error).message}`));
    }
  }

  /**
   * Deletes what nothing will ever show: videos a day old that no post or
   * scheduled post names, uploads that never finished, failures, and every
   * video of an account that is gone (their posts went with it).
   */
  @ExclusiveCron(CronExpression.EVERY_HOUR, { name: 'community-video-sweep' })
  async sweep(now = new Date()): Promise<void> {
    if (!this.mux.enabled) return;
    try {
      const cutoff = new Date(now.getTime() - UNUSED_GRACE_MS);
      let removed = 0;
      // In pages, all the way through: old videos that posts show are kept
      // every hour, and must not fill a page and hide the unused ones behind.
      let cursor: string | undefined;
      for (;;) {
        const page = await this.prisma.communityVideo.findMany({
          where: { OR: [{ ownerId: null }, { createdAt: { lt: cutoff } }] },
          take: 200,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (page.length === 0) break;
        cursor = page[page.length - 1].id;
        removed += await this.sweepPage(page);
        if (page.length < 200) break;
      }
      if (removed > 0) this.logger.log(`Removed ${removed} unused community video(s).`);
    } catch (err) {
      this.logger.error(`Community video sweep failed: ${(err as Error).message}`);
    }
  }

  private async sweepPage(candidates: CommunityVideo[]): Promise<number> {
    let removed = 0;
    for (const video of candidates) {
      // A shown video stays, whoever uploaded it; everything else goes.
      if (video.status === CommunityVideoStatus.READY && (await this.inUse(video))) continue;
      try {
        await this.destroy(video);
        removed += 1;
      } catch (err) {
        // Tried again next hour; one stuck video doesn't hold up the rest.
        this.logger.warn(`Could not delete video ${video.id}: ${(err as Error).message}`);
      }
    }
    return removed;
  }

  /**
   * Brings a row up to date with Mux. Settled rows (READY, FAILED) are
   * returned as they are.
   */
  async refresh(video: CommunityVideo): Promise<CommunityVideo> {
    if (video.status === CommunityVideoStatus.READY || video.status === CommunityVideoStatus.FAILED) return video;

    let current = video;
    if (current.status === CommunityVideoStatus.UPLOADING) {
      const upload = await this.mux.getUpload(current.muxUploadId);
      if (upload.status === 'asset_created' && upload.asset_id) {
        current = await this.prisma.communityVideo.update({
          where: { id: current.id },
          data: { muxAssetId: upload.asset_id, status: CommunityVideoStatus.PROCESSING },
        });
      } else if (['errored', 'cancelled', 'timed_out'].includes(upload.status)) {
        return this.fail(current, upload.status === 'timed_out'
          ? "The upload didn't start in time. Pick the video again."
          : "The upload didn't finish. Pick the video again.");
      } else {
        return current;
      }
    }

    if (!current.muxAssetId) return current;
    const asset = await this.mux.getAsset(current.muxAssetId);
    if (asset.status === 'errored') {
      // Mux's own words are technical ("invalid input file"); ours say what to do.
      this.logger.warn(`Mux asset ${asset.id} errored: ${asset.errors?.messages?.join('; ') ?? asset.errors?.type ?? 'unknown'}`);
      await this.mux.deleteAsset(asset.id).catch(() => undefined);
      return this.fail(current, "That file couldn't be read as a video. Export it as MP4 and try again.");
    }
    if (asset.status !== 'ready') return current;

    const duration = asset.duration ?? 0;
    if (duration > MAX_VIDEO_SECONDS + DURATION_SLACK_SECONDS) {
      await this.mux.deleteAsset(asset.id).catch(() => undefined);
      return this.fail(current, `That video is ${clock(duration)} long. Videos can be up to ${clock(MAX_VIDEO_SECONDS)}.`);
    }
    const playbackId = asset.playback_ids?.find((p) => p.policy === 'public')?.id;
    if (!playbackId) {
      await this.mux.deleteAsset(asset.id).catch(() => undefined);
      return this.fail(current, 'Something went wrong preparing that video. Try again.');
    }
    return this.prisma.communityVideo.update({
      where: { id: current.id },
      data: {
        status: CommunityVideoStatus.READY,
        playbackId,
        durationSeconds: duration,
        aspectRatio: asset.aspect_ratio ?? null,
        failureReason: null,
      },
    });
  }

  view(video: CommunityVideo): VideoView {
    const ready = video.status === CommunityVideoStatus.READY && !!video.playbackId;
    return {
      id: video.id,
      status: video.status.toLowerCase() as VideoView['status'],
      url: ready ? streamUrlFor(video.playbackId!) : null,
      posterUrl: ready ? posterUrlFor(video.playbackId!) : null,
      durationSeconds: video.durationSeconds,
      aspectRatio: video.aspectRatio,
      failureReason: video.failureReason,
    };
  }

  /** Yours, or "not found": someone else's video is not yours to ask about. */
  private async owned(userId: string, id: string): Promise<CommunityVideo> {
    const video = await this.prisma.communityVideo.findUnique({ where: { id } });
    if (!video || video.ownerId !== userId) throw new NotFoundException('Video not found');
    return video;
  }

  /** Whether a post, or a post waiting for its time, shows it. */
  private async inUse(video: CommunityVideo): Promise<boolean> {
    if (!video.playbackId) return false;
    const url = streamUrlFor(video.playbackId);
    const [posts, queued] = await Promise.all([
      this.prisma.post.count({ where: { mediaUrls: { has: url } } }),
      this.prisma.scheduledPost.count({
        where: { status: { not: 'PUBLISHED' }, payload: { path: ['mediaUrls'], array_contains: [url] } },
      }),
    ]);
    return posts + queued > 0;
  }

  /** Gone from Mux, then from here. */
  private async destroy(video: CommunityVideo): Promise<void> {
    if (video.muxAssetId) await this.mux.deleteAsset(video.muxAssetId);
    else await this.mux.cancelUpload(video.muxUploadId);
    await this.prisma.communityVideo.delete({ where: { id: video.id } }).catch(() => undefined);
  }

  private fail(video: CommunityVideo, reason: string): Promise<CommunityVideo> {
    return this.prisma.communityVideo.update({
      where: { id: video.id },
      data: { status: CommunityVideoStatus.FAILED, failureReason: reason },
    });
  }
}

/** 600 → "10:00", 75.4 → "1:15". */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
