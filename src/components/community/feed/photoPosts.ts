import { create } from "zustand";
import type { MediaKind } from "@/lib/api/community";

/**
 * Pictures uploading behind the composer, and posts sent before they finished.
 *
 * A picked picture shows in the draft at once, from the file, and uploads
 * while the post is being written: nothing in the composer waits for it. If
 * Post is pressed first, the post is handed here, the composer closes, and it
 * goes out the moment the last picture is up. The same as a long video (see
 * videoUploads.ts), and as on Threads.
 */

// One at a time, for the whole page: four at once on a phone connection is
// how one of them times out.
let line: Promise<unknown> = Promise.resolve();

/**
 * Runs an upload after the ones started before it, whether they worked or
 * not. One taken out of the draft while it waits is never started.
 */
export function inTurn<T>(upload: () => Promise<T>, signal: AbortSignal): Promise<T> {
  const turn = line.then(() => {
    signal.throwIfAborted();
    return upload();
  });
  line = turn.catch(() => undefined);
  return turn;
}

/** A post sent while its pictures were still uploading. */
export interface PhotoPost {
  key: string;
  /** Its first picture, so it's clear in the bar which post this is. */
  preview: { url: string; kind: MediaKind };
  count: number;
  /** All pictures (no clips), which decides what the bar calls them. */
  allImages: boolean;
  status: "waiting" | "sending" | "posted" | "failed";
  postId?: string;
  error?: string;
}

interface PhotoPostState {
  posts: Record<string, PhotoPost>;
  /**
   * Sends the post once every upload has finished, with their addresses in
   * the order they were picked. The preview's address is the bar's to let go.
   */
  postWhenUploaded: (post: {
    preview: PhotoPost["preview"];
    allImages: boolean;
    uploads: Promise<string>[];
    /** Creates the post; resolves to its id. */
    send: (mediaUrls: string[]) => Promise<string>;
  }) => void;
  /** Clears a finished or failed post from the page. */
  dismiss: (key: string) => void;
}

export const usePhotoPosts = create<PhotoPostState>((set, get) => {
  const patch = (key: string, change: Partial<PhotoPost>) =>
    set((s) => (s.posts[key] ? { posts: { ...s.posts, [key]: { ...s.posts[key], ...change } } } : s));

  return {
    posts: {},

    postWhenUploaded: ({ preview, allImages, uploads, send }) => {
      const key = crypto.randomUUID();
      set((s) => ({
        posts: { ...s.posts, [key]: { key, preview, count: uploads.length, allImages, status: "waiting" } },
      }));
      void (async () => {
        let mediaUrls: string[];
        try {
          mediaUrls = await Promise.all(uploads);
        } catch (err) {
          const noun = allImages ? "A photo" : "An attachment";
          patch(key, { status: "failed", error: `${noun} didn't upload. ${(err as Error).message || "Check your connection and try again."}` });
          return;
        }
        if (!get().posts[key]) return;
        patch(key, { status: "sending" });
        try {
          patch(key, { status: "posted", postId: await send(mediaUrls) });
        } catch (err) {
          patch(key, { status: "failed", error: (err as Error).message || "The post couldn't be published." });
        }
      })();
    },

    dismiss: (key) => {
      const post = get().posts[key];
      if (!post) return;
      if (post.preview.url.startsWith("blob:")) URL.revokeObjectURL(post.preview.url);
      set((s) => {
        const { [key]: _gone, ...rest } = s.posts;
        return { posts: rest };
      });
    },
  };
});

/** Leaving the page before the pictures are up loses the post, so the browser asks first. */
if (typeof window !== "undefined") {
  const warn = (e: BeforeUnloadEvent) => e.preventDefault();
  let guarding = false;
  usePhotoPosts.subscribe((state) => {
    const atRisk = Object.values(state.posts).some((p) => p.status === "waiting" || p.status === "sending");
    if (atRisk && !guarding) window.addEventListener("beforeunload", warn);
    if (!atRisk && guarding) window.removeEventListener("beforeunload", warn);
    guarding = atRisk;
  });
}
