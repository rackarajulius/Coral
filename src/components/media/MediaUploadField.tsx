import { useRef, useState } from "react";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isVideoUrl, uploadPostMedia } from "@/lib/api/community";

/** The server's video limit: one, of up to a minute. */
const MAX_VIDEO_SECONDS = 60;

/** A video's length in seconds, read from the file before uploading it; null if unreadable. */
function videoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(video.duration) ? video.duration : null); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

/**
 * Pictures and one short video of some work: a service listing's, a
 * project's.
 *
 * Uploaded through the same media upload as community posts, so files are
 * checked by what they are, not their names, and stored on Coral. The first
 * picture is the cover; any other can be put first with "Make cover".
 */
export function MediaUploadField({ value, onChange, maxPictures, note }: {
  value: string[];
  onChange: (next: string[]) => void;
  maxPictures: number;
  /** Said after the limits, e.g. "Save the listing to keep them." */
  note?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const picturesRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const pictures = value.filter((url) => !isVideoUrl(url));
  const video = value.find((url) => isVideoUrl(url));

  const add = async (files: FileList | null, kind: "picture" | "video") => {
    if (!files?.length) return;
    setUploading(true);
    let next = [...value];
    try {
      for (const file of Array.from(files)) {
        if (kind === "picture" && next.filter((url) => !isVideoUrl(url)).length >= maxPictures) {
          toast.error(`Up to ${maxPictures} pictures.`);
          break;
        }
        if (kind === "video") {
          const seconds = await videoSeconds(file);
          if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
            toast.error(`That video is ${Math.round(seconds)}s. Keep it under ${MAX_VIDEO_SECONDS}s.`);
            break;
          }
        }
        const uploaded = await uploadPostMedia(file);
        if ((uploaded.kind === "video") !== (kind === "video")) {
          toast.error(kind === "video" ? "That file is a picture, not a video." : "That file is a video. Use Add a video.");
          continue;
        }
        // One video: a new one replaces the old.
        next = uploaded.kind === "video" ? [...next.filter((url) => !isVideoUrl(url)), uploaded.url] : [...next, uploaded.url];
      }
    } catch (e) {
      // Verbatim: the server says what was wrong with the file.
      toast.error((e as Error).message);
    } finally {
      onChange(next);
      setUploading(false);
      if (picturesRef.current) picturesRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const remove = (url: string) => onChange(value.filter((item) => item !== url));
  const makeCover = (url: string) => onChange([url, ...value.filter((item) => item !== url)]);

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[...pictures, ...(video ? [video] : [])].map((url, index) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
              {isVideoUrl(url) ? (
                <video src={url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
              ) : (
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
              {isVideoUrl(url) && (
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-foreground/75 px-2 py-0.5 text-[10px] font-medium text-background">
                  <Video className="h-3 w-3" aria-hidden="true" /> Video
                </span>
              )}
              {!isVideoUrl(url) && index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-foreground/75 px-2 py-0.5 text-[10px] font-medium text-background">Cover</span>
              )}
              {!isVideoUrl(url) && index > 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  className="absolute bottom-1.5 left-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label={isVideoUrl(url) ? "Remove video" : `Remove picture ${index + 1}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-foreground/80 p-1 text-background"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={picturesRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => void add(e.target.files, "picture")} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => void add(e.target.files, "video")} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading || pictures.length >= maxPictures} onClick={() => picturesRef.current?.click()}>
          <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />Add pictures
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => videoRef.current?.click()}>
          <Video className="mr-2 h-4 w-4" aria-hidden="true" />{video ? "Replace video" : "Add a video"}
        </Button>
        {uploading && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Uploading…</span>}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Up to {maxPictures} pictures (PNG, JPEG, WebP or GIF, 5MB each) and one video (MP4 or WebM, up to {MAX_VIDEO_SECONDS}s and 30MB). Optional.{note ? ` ${note}` : ""}
      </p>
    </div>
  );
}

export default MediaUploadField;
