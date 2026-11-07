import { useState } from "react";
import { ExternalLink, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageLightbox } from "@/components/community/feed/ImageLightbox";
import { isVideoUrl } from "@/lib/api/community";
import { safeProviderLink } from "@/lib/api/providers";
import type { ServiceListing } from "@/lib/api/marketplace";

/** A service's cover: its first picture, or the first frame of its video; nothing when it has neither. */
export function ListingCoverMedia({ mediaUrls, className }: { mediaUrls: string[]; className?: string }) {
  const picture = mediaUrls.find((url) => !isVideoUrl(url));
  const video = mediaUrls.find((url) => isVideoUrl(url));
  if (picture) return <img src={picture} alt="" loading="lazy" className={className} />;
  if (video) return <video src={video} preload="metadata" muted playsInline className={className} aria-hidden="true" />;
  return null;
}

/**
 * A video and pictures of some work: on a service's page, under a project.
 * The video is muted to start, with controls — nothing plays sound on its
 * own; pictures open full size. `compact` keeps it small, under a project.
 */
export function MediaGallery({ mediaUrls, compact = false }: { mediaUrls: string[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const pictures = mediaUrls.filter((url) => !isVideoUrl(url));
  const video = mediaUrls.find((url) => isVideoUrl(url));
  if (!pictures.length && !video) return null;

  return (
    <div className="space-y-3">
      {video && (
        <video src={video} controls muted playsInline preload="metadata" className={`aspect-video w-full rounded-xl bg-muted/40 object-contain ${compact ? "max-w-md" : ""}`} />
      )}
      {pictures.length > 0 && (
        <div className={compact ? "grid grid-cols-3 gap-2 sm:grid-cols-4" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
          {pictures.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`View picture ${index + 1} of ${pictures.length} full size`}
              className="aspect-[4/3] overflow-hidden rounded-xl border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
            </button>
          ))}
        </div>
      )}
      <ImageLightbox images={pictures} index={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** The pictures and video on a service's own page. Renders nothing when there are none. */
export function ListingGallery({ mediaUrls }: { mediaUrls: string[] }) {
  if (!mediaUrls.length) return null;
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-lg">The work</CardTitle></CardHeader>
      <CardContent><MediaGallery mediaUrls={mediaUrls} /></CardContent>
    </Card>
  );
}

/**
 * One work sample. A YouTube or Vimeo video shows as a card with its
 * thumbnail (Coral's own copy) and title; clicking goes to the video. Never
 * an embedded player, which would let the video site follow every visitor.
 */
export function WorkSampleLink({ sample }: { sample: ServiceListing["workSamples"][number] }) {
  const url = safeProviderLink(sample.url);
  if (!url) return null;
  const preview = sample.preview;
  if (preview) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex overflow-hidden rounded-lg border text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative flex w-32 shrink-0 items-center justify-center bg-muted/60 sm:w-40">
          {preview.imageUrl && <img src={preview.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
          <PlayCircle className="relative h-8 w-8 text-background drop-shadow" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 p-3">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{preview.siteName}</span>
          <span className="line-clamp-2 break-words font-medium">{sample.label}</span>
          {preview.title && preview.title !== sample.label && <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview.title}</span>}
          <span className="sr-only"> (opens in a new tab)</span>
        </span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="min-w-0 break-words">{sample.label}</span>
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
