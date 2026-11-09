import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isVideoUrl } from "@/lib/api/community";
import { FeedVideo } from "./FeedVideo";
import { UNKNOWN_SHAPE, stepTarget, stripEdges, tileRatio } from "./mediaStrip";

/**
 * A post's pictures and videos.
 *
 * One picture is shown whole. Two or more are a row you swipe through, as on
 * X: one height for the row, each picture in its own shape, the next one
 * showing at the edge so it's clear there are more. A grid of squares cropped
 * every picture and, at three, left a hole; at four it was taller than a
 * laptop screen. Videos keep their own player, above the pictures.
 */
export function PostMedia({ urls, onOpenPicture }: { urls: string[]; onOpenPicture: (index: number) => void }) {
  const videos = urls.filter((url) => isVideoUrl(url));
  const pictures = urls.filter((url) => !isVideoUrl(url));
  return (
    <>
      {videos.length > 0 && (
        <div className="mt-3 space-y-2">
          {/* Plays muted while on screen, one at a time — see FeedVideo. */}
          {videos.map((src) => <FeedVideo key={src} src={src} />)}
        </div>
      )}
      {pictures.length === 1 && <OnePicture url={pictures[0]} onOpen={() => onOpenPicture(0)} />}
      {pictures.length > 1 && <PictureRow urls={pictures} onOpen={onOpenPicture} />}
    </>
  );
}

function OnePicture({ url, onOpen }: { url: string; onOpen: () => void }) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label="View image full size"
        className="block w-full overflow-hidden rounded-xl bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          // Shown whole — a diagram or a screenshot cropped at the edges loses
          // the part that mattered. Very tall ones stop at 600px and fit
          // inside it, with the muted background either side.
          className="block h-auto max-h-[37.5rem] w-full object-contain"
          onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
        />
      </button>
    </div>
  );
}

function PictureRow({ urls, onOpen }: { urls: string[]; onOpen: (index: number) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Each picture's shape, known once it has loaded; square until then.
  const [ratios, setRatios] = useState<number[]>(() => urls.map(() => UNKNOWN_SHAPE));
  const [edges, setEdges] = useState({ canPrevious: false, canNext: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (row) setEdges(stripEdges(row.scrollLeft, row.clientWidth, row.scrollWidth));
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);
  // The row grows or shrinks as pictures load and take their shapes.
  useEffect(measure, [ratios, measure]);

  // Where the last click sent the row, while it is still sliding there: a
  // quick second click goes on from there instead of aiming at the same one.
  const aim = useRef<{ left: number; at: number } | null>(null);

  /** One picture along, landing on its start as a swipe would. */
  const step = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const padding = parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0;
    const starts = Array.from(row.children, (tile) => (tile as HTMLElement).offsetLeft - padding);
    const sliding = aim.current && performance.now() - aim.current.at < 700 ? aim.current.left : null;
    const left = stepTarget(starts, sliding ?? row.scrollLeft, direction, row.scrollWidth - row.clientWidth);
    aim.current = { left, at: performance.now() };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left, behavior: still ? "auto" : "smooth" });
  };

  return (
    // Out to the card's edges, so pictures slide under its padding rather than
    // stopping short of it; the first still lines up with the text.
    <div className="group/row relative -mx-5 mt-3">
      <div
        ref={rowRef}
        onScroll={measure}
        role="group"
        aria-label={`${urls.length} pictures`}
        // overscroll-x-contain: a sideways swipe at the end stays here rather
        // than becoming the browser's Back.
        className="no-scrollbar relative flex h-72 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 sm:h-[22rem]"
      >
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`View picture ${i + 1} of ${urls.length} full size`}
            className="relative h-full shrink-0 snap-start overflow-hidden rounded-lg bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            style={{ aspectRatio: ratios[i] }}
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
              onLoad={(e) => {
                const ratio = tileRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
                setRatios((all) => (all[i] === ratio ? all : all.map((r, n) => (n === i ? ratio : r))));
              }}
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
            />
          </button>
        ))}
      </div>

      {/* For a mouse; fingers and trackpads swipe. Only where there's more. */}
      {edges.canPrevious && <RowArrow side="left" onClick={() => step(-1)} />}
      {edges.canNext && <RowArrow side="right" onClick={() => step(1)} />}
    </div>
  );
}

function RowArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous picture" : "Next picture"}
      className={cn(
        "absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground opacity-0 shadow-md backdrop-blur-sm transition-opacity hover:bg-background focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100 [@media(hover:hover)]:flex",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default PostMedia;
