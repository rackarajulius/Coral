import { BadRequestException } from '@nestjs/common';
import { isOurStorageHost } from '../storage/our-storage-url';
import { COMMUNITY_BUCKET } from '../storage/storage.service';

/**
 * Pictures and video that something other than a post shows — a service
 * listing, a profile project — uploaded through the community media upload.
 */

const PICTURE_FILE = /\.(png|jpe?g|webp|gif)$/i;
const VIDEO_FILE = /\.(mp4|webm)$/i;

/**
 * A picture or video its owner uploaded through Coral's own media upload, or
 * null. Same rule as community posts: never a file from another site — that
 * is a tracking pixel, or something that changes after anyone looked at it —
 * and only the owner's own uploads, which the hourly clean-up keeps while
 * something uses them.
 */
export function ownUploadedMedia(value: unknown, ownerUserId: string): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const file = url.pathname;
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && isOurStorageHost(url)
      && file.includes(`/${COMMUNITY_BUCKET}/posts/${ownerUserId}/`) && (PICTURE_FILE.test(file) || VIDEO_FILE.test(file)) ? url.href : null;
  } catch { return null; }
}

export function isVideoFile(url: string): boolean {
  try { return VIDEO_FILE.test(new URL(url).pathname); } catch { return false; }
}

/**
 * Up to `maxPictures` pictures and one video, each once, all the owner's own.
 * `subject` and `owner` word the refusals: "A service can show one video",
 * "…uploaded here, by the listing owner".
 */
export function assertOwnMedia(value: unknown, ownerUserId: string, rule: { maxPictures: number; subject: string; owner: string }) {
  if (value === undefined) return;
  const { maxPictures, subject, owner } = rule;
  if (!Array.isArray(value) || value.length > maxPictures + 1) throw new BadRequestException(`${subject} can show up to ${maxPictures} pictures and one video`);
  if (value.some(url => !ownUploadedMedia(url, ownerUserId))) throw new BadRequestException(`Pictures and video have to be uploaded here, by ${owner}`);
  if (new Set(value).size !== value.length) throw new BadRequestException('Each picture can appear once');
  const videos = value.filter(url => isVideoFile(url)).length;
  if (videos > 1) throw new BadRequestException(`${subject} can show one video`);
  if (value.length - videos > maxPictures) throw new BadRequestException(`${subject} can show up to ${maxPictures} pictures`);
}
