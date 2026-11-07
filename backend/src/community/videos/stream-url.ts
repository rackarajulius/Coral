/**
 * How a streamed video appears in a post: its Mux stream URL, the one thing a
 * post's `mediaUrls` can hold that isn't in our storage.
 */

const STREAM_URL = /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]{1,128})\.m3u8$/;

/** The playback id a stream URL names, or null for anything else. */
export function playbackIdOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  return STREAM_URL.exec(url)?.[1] ?? null;
}

export const isStreamUrl = (url: unknown): boolean => playbackIdOf(url) !== null;

export const streamUrlFor = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`;

/** A frame a second in, so a video that fades in from black has a picture. */
export const posterUrlFor = (playbackId: string) => `https://image.mux.com/${playbackId}/thumbnail.webp?width=960&time=1`;
