import { create } from "zustand";
import {
  discardCommunityVideo, getCommunityVideo, startVideoUpload, type CommunityVideo,
} from "@/lib/api/community";

/**
 * Long videos on their way to Mux, kept for the whole page rather than inside
 * the composer — so, as on Threads, someone can press Post while a video is
 * still uploading, close the composer, and carry on reading. The post goes
 * out the moment its video is ready to stream.
 *
 * Each upload goes from this browser straight to Mux in 5MB pieces that are
 * retried and resume after the connection drops. Where it got to after that
 * is asked of the server (which asks Mux) every few seconds.
 */

export type VideoPhase = "uploading" | "processing" | "ready" | "failed";

/** A post written while its video was still on the way. */
export interface PendingVideoPost {
  status: "waiting" | "sending" | "posted" | "failed";
  /** Creates the post with the video's stream URL; resolves to the new post's id. */
  send: (streamUrl: string) => Promise<string>;
  postId?: string;
  error?: string;
}

export interface VideoUpload {
  /** Ours, on this page. */
  key: string;
  /** The server's, once an upload address has been given. */
  id: string | null;
  name: string;
  /** The picked file, played in the composer before any of it is uploaded. */
  previewUrl: string;
  phase: VideoPhase;
  /** Percent sent. */
  progress: number;
  video?: CommunityVideo;
  error?: string;
  pending?: PendingVideoPost;
}

interface VideoUploadState {
  uploads: Record<string, VideoUpload>;
  /** Starts sending a file; returns the key to follow it by. */
  start: (file: File) => string;
  /** Out of the draft: stopped, and deleted from Mux. */
  remove: (key: string) => void;
  /** Sends the post as soon as the video is ready — at once, if it already is. */
  postWhenReady: (key: string, send: PendingVideoPost["send"]) => void;
  /** Clears a finished or failed post from the page. */
  dismiss: (key: string) => void;
}

const POLL_MS = 2500;
const UPLOAD_STOPPED = "The upload stopped. Check your connection and try again.";

// Not React state: the running upload and the polling timer behind each key.
const uploaders = new Map<string, { abort: () => void }>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

export const useVideoUploads = create<VideoUploadState>((set, get) => {
  const patch = (key: string, change: Partial<VideoUpload>) =>
    set((s) => (s.uploads[key] ? { uploads: { ...s.uploads, [key]: { ...s.uploads[key], ...change } } } : s));
  const patchPending = (key: string, change: Partial<PendingVideoPost>) => {
    const current = get().uploads[key]?.pending;
    if (current) patch(key, { pending: { ...current, ...change } });
  };

  const stopPolling = (key: string) => {
    clearInterval(timers.get(key));
    timers.delete(key);
  };

  /** A failure, said once, and passed on to a post waiting for the video. */
  const fail = (key: string, error: string) => {
    stopPolling(key);
    uploaders.delete(key);
    patch(key, { phase: "failed", error });
    if (get().uploads[key]?.pending?.status === "waiting") {
      patchPending(key, { status: "failed", error });
    }
  };

  const sendIfWaiting = async (key: string) => {
    const upload = get().uploads[key];
    if (!upload?.pending || upload.pending.status !== "waiting" || upload.phase !== "ready" || !upload.video?.url) return;
    patchPending(key, { status: "sending" });
    try {
      const postId = await upload.pending.send(upload.video.url);
      patchPending(key, { status: "posted", postId });
    } catch (err) {
      patchPending(key, { status: "failed", error: (err as Error).message || "The post couldn't be published." });
    }
  };

  const poll = (key: string, id: string) => {
    const check = async () => {
      if (!get().uploads[key]) return stopPolling(key);
      try {
        const video = await getCommunityVideo(id);
        if (video.status === "ready") {
          stopPolling(key);
          patch(key, { phase: "ready", video });
          void sendIfWaiting(key);
        } else if (video.status === "failed") {
          fail(key, video.failureReason ?? "That video couldn't be prepared.");
        }
      } catch {
        // A missed check is tried again on the next tick.
      }
    };
    timers.set(key, setInterval(() => void check(), POLL_MS));
    void check();
  };

  return {
    uploads: {},

    start: (file) => {
      const key = crypto.randomUUID();
      set((s) => ({
        uploads: {
          ...s.uploads,
          [key]: { key, id: null, name: file.name, previewUrl: URL.createObjectURL(file), phase: "uploading", progress: 0 },
        },
      }));

      void (async () => {
        try {
          const { id, uploadUrl } = await startVideoUpload();
          // Taken out while the address was being fetched: nothing to send.
          if (!get().uploads[key]) {
            void discardCommunityVideo(id).catch(() => undefined);
            return;
          }
          patch(key, { id });
          const { createUpload } = await import("@mux/upchunk");
          const upload = createUpload({ endpoint: uploadUrl, file, chunkSize: 5120 });
          uploaders.set(key, upload);
          upload.on("progress", (e) => patch(key, { progress: Number(e.detail) || 0 }));
          upload.on("success", () => {
            uploaders.delete(key);
            patch(key, { phase: "processing", progress: 100 });
            poll(key, id);
          });
          upload.on("error", () => {
            fail(key, UPLOAD_STOPPED);
            void discardCommunityVideo(id).catch(() => undefined);
          });
        } catch (err) {
          fail(key, (err as Error).message || UPLOAD_STOPPED);
        }
      })();
      return key;
    },

    remove: (key) => {
      const upload = get().uploads[key];
      if (!upload) return;
      uploaders.get(key)?.abort();
      uploaders.delete(key);
      stopPolling(key);
      URL.revokeObjectURL(upload.previewUrl);
      if (upload.id && upload.pending?.status !== "posted") {
        void discardCommunityVideo(upload.id).catch(() => undefined);
      }
      set((s) => {
        const { [key]: _gone, ...rest } = s.uploads;
        return { uploads: rest };
      });
    },

    postWhenReady: (key, send) => {
      if (!get().uploads[key]) return;
      patch(key, { pending: { status: "waiting", send } });
      void sendIfWaiting(key);
    },

    dismiss: (key) => {
      const upload = get().uploads[key];
      if (!upload) return;
      // A posted video belongs to its post now; anything else is let go.
      if (upload.pending?.status === "posted") {
        URL.revokeObjectURL(upload.previewUrl);
        set((s) => {
          const { [key]: _gone, ...rest } = s.uploads;
          return { uploads: rest };
        });
      } else {
        get().remove(key);
      }
    },
  };
});

/**
 * Leaving the page mid-upload loses the video, and with it any post waiting
 * for it — so the browser asks first.
 */
if (typeof window !== "undefined") {
  const warn = (e: BeforeUnloadEvent) => e.preventDefault();
  let guarding = false;
  useVideoUploads.subscribe((state) => {
    const atRisk = Object.values(state.uploads).some(
      (u) => u.phase === "uploading" || (u.pending && (u.pending.status === "waiting" || u.pending.status === "sending")),
    );
    if (atRisk && !guarding) window.addEventListener("beforeunload", warn);
    if (!atRisk && guarding) window.removeEventListener("beforeunload", warn);
    guarding = atRisk;
  });
}
