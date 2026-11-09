import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import type { MediaKind } from "@/lib/api/community";
import { useVideoUploads, type VideoUpload } from "./videoUploads";
import { usePhotoPosts, type PhotoPost } from "./photoPosts";

/** How long "Posted" stays up before it clears itself. */
const POSTED_VISIBLE_MS = 8000;

/** One line in the bar, whatever the post is waiting for. */
interface QueueRow {
  key: string;
  preview: { url: string; kind: MediaKind };
  status: "waiting" | "sending" | "posted" | "failed";
  /** What it says while waiting. */
  waiting: string;
  detail: string | null;
  /** Percent, when there is a measure of it. */
  progress: number | null;
  postId?: string;
  dismiss: () => void;
}

function videoRow(upload: VideoUpload, dismiss: (key: string) => void): QueueRow {
  const pending = upload.pending!;
  return {
    key: upload.key,
    preview: { url: upload.previewUrl, kind: "video" },
    status: pending.status,
    waiting: "Posting your video…",
    detail: pending.status === "failed"
      ? pending.error ?? upload.error ?? "Something went wrong."
      : upload.phase === "uploading"
        ? `Uploading ${Math.floor(upload.progress)}% · keep this tab open`
        : upload.phase === "processing" && pending.status === "waiting"
          ? "Preparing it for streaming"
          : null,
    progress: upload.phase === "uploading" ? upload.progress : null,
    postId: pending.postId,
    dismiss: () => dismiss(upload.key),
  };
}

function photoRow(post: PhotoPost, dismiss: (key: string) => void): QueueRow {
  const noun = post.allImages
    ? post.count === 1 ? "photo" : `${post.count} photos`
    : post.count === 1 ? "attachment" : `${post.count} attachments`;
  return {
    key: post.key,
    preview: post.preview,
    status: post.status,
    waiting: "Posting…",
    detail: post.status === "failed"
      ? post.error ?? "Something went wrong."
      : post.status === "waiting"
        ? `Uploading your ${noun} · keep this tab open`
        : null,
    progress: null,
    postId: post.postId,
    dismiss: () => dismiss(post.key),
  };
}

/**
 * Posts sent before their video or pictures had finished uploading, finishing
 * on their own: Threads' "Posting…" bar. One line each at the foot of the
 * page, then a link to the post once it is up, or why it didn't go.
 */
export function PostQueue() {
  const uploads = useVideoUploads((s) => s.uploads);
  const dismissVideo = useVideoUploads((s) => s.dismiss);
  const photoPosts = usePhotoPosts((s) => s.posts);
  const dismissPhotos = usePhotoPosts((s) => s.dismiss);
  const rows = [
    ...Object.values(uploads).filter((u) => u.pending).map((u) => videoRow(u, dismissVideo)),
    ...Object.values(photoPosts).map((p) => photoRow(p, dismissPhotos)),
  ];
  if (rows.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
      aria-live="polite"
    >
      {rows.map((row) => (
        <QueueItem key={row.key} row={row} />
      ))}
    </div>
  );
}

function QueueItem({ row }: { row: QueueRow }) {
  const failed = row.status === "failed";
  const posted = row.status === "posted";
  // The latest, so the timer below isn't restarted by every redraw.
  const dismissRef = useRef(row.dismiss);
  dismissRef.current = row.dismiss;

  useEffect(() => {
    if (!posted) return;
    const t = setTimeout(() => dismissRef.current(), POSTED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [posted]);

  const title = failed ? "Your post didn't go out" : posted ? "Posted" : row.status === "sending" ? "Publishing…" : row.waiting;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center gap-3 p-3">
        {/* The first frame or picture, so it's clear which post this is. */}
        {row.preview.kind === "video" ? (
          <video
            src={row.preview.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="h-10 w-10 shrink-0 rounded-md bg-black object-cover"
          />
        ) : (
          <img src={row.preview.url} alt="" className="h-10 w-10 shrink-0 rounded-md bg-muted object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {failed ? (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            ) : posted ? (
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
            {title}
          </p>
          {row.detail && !posted && (
            <p className={failed ? "text-xs text-destructive" : "text-xs tabular-nums text-muted-foreground"}>{row.detail}</p>
          )}
        </div>
        {posted && row.postId && (
          <Link to={`/community/posts/${row.postId}`} onClick={row.dismiss} className="text-sm font-medium text-link hover:underline">
            View
          </Link>
        )}
        {(failed || posted) && (
          <button
            type="button"
            onClick={row.dismiss}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {!failed && !posted && row.progress !== null && (
        <div className="h-1 bg-muted" aria-hidden="true">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(2, row.progress)}%` }} />
        </div>
      )}
    </div>
  );
}

export default PostQueue;
