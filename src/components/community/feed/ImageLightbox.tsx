import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A post's images at full size, one at a time.
 *
 * Built on the Radix dialog so focus is trapped, Escape closes it and the page
 * behind does not scroll. Arrow keys step through a multi-image post; a single
 * image gets no arrows and no counter, since there is nowhere to go.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: string[];
  /** The image to open on, or null when closed. */
  index: number | null;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index ?? 0);
  const open = index !== null;
  const count = images.length;
  const many = count > 1;

  // Each opening starts on the image that was clicked.
  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  const prev = () => setCurrent((i) => (i - 1 + count) % count);
  const next = () => setCurrent((i) => (i + 1) % count);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (!many) return;
            if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
            if (e.key === "ArrowRight") { e.preventDefault(); next(); }
          }}
          // Clicking the dark area around the image closes it, as the overlay
          // would if the content did not cover the whole screen.
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <DialogPrimitive.Title className="sr-only">
            {many ? `Image ${current + 1} of ${count}` : "Image"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {many ? "Use the left and right arrow keys to move between images." : "Full-size view."}
          </DialogPrimitive.Description>

          {open && images[current] && (
            <img
              key={images[current]}
              src={images[current]}
              alt=""
              className="max-h-[90vh] max-w-[92vw] select-none rounded-lg object-contain"
            />
          )}

          <DialogPrimitive.Close
            className={cn(controlClass, "absolute right-4 top-4")}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>

          {many && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous image"
                className={cn(controlClass, "absolute left-4 top-1/2 -translate-y-1/2")}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next image"
                className={cn(controlClass, "absolute right-4 top-1/2 -translate-y-1/2")}
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>

              <p
                className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums text-white"
                aria-live="polite"
              >
                {current + 1} / {count}
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const controlClass =
  "flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

export default ImageLightbox;
