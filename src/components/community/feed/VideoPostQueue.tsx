import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useVideoUploads, type VideoUpload } from "./videoUploads";

/** How long "Posted" stays up before it clears itself. */
const POSTED_VISIBLE_MS = 8000;

/**
 * Posts sent while their video was still uploading, finishing on their own —
 * Threads' "Posting…" bar. One line each at the foot of the page: how far the
 * video has got, then a link to the post once it is up, or why it didn't go.
 */
export function VideoPostQueue() {
  const uploads = useVideoUploads((s) => s.uploads);
  const dismiss = useVideoUploads((s) => s.dismiss);
  const posting = Object.values(uploads).filter((u) => u.pending);
  if (posting.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
      aria-live="polite"
    >
      {posting.map((upload) => (
        <QueueItem key={upload.key} upload={upload} onDismiss={() => dismiss(upload.key)} />
      ))}
    </div>
  );
}

function QueueItem({ upload, onDismiss }: { upload: VideoUpload; onDismiss: () => void }) {
  const status = upload.pending!.status;
  const failed = status === "failed";
  const posted = status === "posted";

  useEffect(() => {
    if (!posted) return;
    const t = setTimeout(onDismiss, POSTED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [posted, onDismiss]);

  const title = failed ? "Your post didn't go out" : posted ? "Posted" : status === "sending" ? "Publishing…" : "Posting your video…";
  const detail = failed
    ? upload.pending!.error ?? upload.error ?? "Something went wrong."
    : posted
      ? null
      : upload.phase === "uploading"
        ? `Uploading ${Math.floor(upload.progress)}% · keep this tab open`
        : upload.phase === "processing"
          ? "Preparing it for streaming"
          : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center gap-3 p-3">
        {/* The first frame, so it's clear which post this is. */}
        <video
          src={upload.previewUrl}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="h-10 w-10 shrink-0 rounded-md bg-black object-cover"
        />
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
          {detail && <p className={failed ? "text-xs text-destructive" : "text-xs tabular-nums text-muted-foreground"}>{detail}</p>}
        </div>
        {posted && upload.pending!.postId && (
          <Link to={`/community/posts/${upload.pending!.postId}`} onClick={onDismiss} className="text-sm font-medium text-link hover:underline">
            View
          </Link>
        )}
        {(failed || posted) && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {!failed && !posted && upload.phase === "uploading" && (
        <div className="h-1 bg-muted" aria-hidden="true">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(2, upload.progress)}%` }} />
        </div>
      )}
    </div>
  );
}

export default VideoPostQueue;
