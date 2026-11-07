import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2, Maximize2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PdfJs = typeof import("pdfjs-dist");

let pdfjs: Promise<PdfJs> | null = null;

/**
 * pdf.js and its worker, fetched the first time a document comes on screen.
 *
 * Together they are well over a megabyte; a feed with no documents in view
 * should not pay for them, so nothing here is imported until then.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjs;
}

/**
 * Opens the PDF once the card is near the screen, and closes it when the card
 * goes away. The file is a public one in our own bucket; scripts and forms in
 * it are never run — pdf.js only draws the pages.
 */
function usePdf(url: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const seen = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "400px 0px" },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let task: ReturnType<PdfJs["getDocument"]> | null = null;
    setFailed(false);
    loadPdfJs()
      .then((lib) => {
        if (cancelled) return null;
        task = lib.getDocument({ url, enableXfa: false });
        return task.promise;
      })
      .then((loaded) => {
        if (!cancelled && loaded) setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      void task?.destroy();
      setDoc(null);
    };
  }, [near, url]);

  return { ref, doc, failed };
}

/**
 * A document post: a PDF read a page at a time in the feed, like a deck.
 *
 * Arrows on the page, the arrow keys once it has focus, or a swipe, turn the
 * page; the corner button opens it larger. "Open PDF" is always there, for
 * reading it some other way or when it cannot be drawn here.
 */
export function DocumentViewer({ url, title, pages }: { url: string; title: string; pages: number | null }) {
  const { ref, doc, failed } = usePdf(url);
  const [page, setPage] = useState(1);
  const [large, setLarge] = useState(false);
  const total = doc?.numPages ?? pages ?? 0;

  return (
    <div ref={ref} className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>{title}</p>
        {total > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {total} {total === 1 ? "page" : "pages"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setLarge(true)}
          disabled={!doc}
          aria-label="Open larger"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open PDF in a new tab"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <PageStage doc={doc} failed={failed} url={url} page={page} total={total} onPage={setPage} label={title} />

      <Dialog open={large} onOpenChange={setLarge}>
        <DialogContent className="max-w-4xl gap-3 rounded-2xl p-4 sm:p-5">
          <DialogTitle className="pr-8 text-base">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            A document of {total} pages. Use the arrow keys or the buttons to turn the page.
          </DialogDescription>
          <PageStage doc={doc} failed={failed} url={url} page={page} total={total} onPage={setPage} label={title} large />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageStage({
  doc,
  failed,
  url,
  page,
  total,
  onPage,
  label,
  large = false,
}: {
  doc: PDFDocumentProxy | null;
  failed: boolean;
  url: string;
  page: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
  large?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // Width over height of the page on show; the first page's until one is drawn.
  const [ratio, setRatio] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const swipeFrom = useRef<number | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    measure.observe(el);
    return () => measure.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || width === 0) return;
    let cancelled = false;
    let render: { cancel: () => void } | null = null;
    setDrawing(true);
    doc
      .getPage(page)
      .then((p) => {
        if (cancelled) return;
        const natural = p.getViewport({ scale: 1 });
        setRatio(natural.width / natural.height);
        // Drawn at the screen's own density so text stays sharp, and no wider
        // than the box: a phone does not need a poster-sized bitmap.
        const scale = (width * Math.min(window.devicePixelRatio || 1, 2)) / natural.width;
        const viewport = p.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const task = p.render({ canvas, viewport });
        render = task;
        return task.promise;
      })
      .then(() => {
        if (!cancelled) setDrawing(false);
      })
      .catch(() => {
        // A cancelled render rejects too; only the latest one matters.
        if (!cancelled) setDrawing(false);
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, page, width]);

  const go = useCallback(
    (to: number) => {
      if (total > 0) onPage(Math.min(Math.max(to, 1), total));
    },
    [onPage, total],
  );

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
        <FileText className="h-6 w-6" aria-hidden="true" />
        This document can't be shown here.
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
          Open the PDF
        </a>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      role="group"
      aria-roledescription="document"
      aria-label={`${label}, page ${page} of ${total || "?"}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(page + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(page - 1);
        }
      }}
      onTouchStart={(e) => {
        swipeFrom.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const from = swipeFrom.current;
        const to = e.changedTouches[0]?.clientX;
        swipeFrom.current = null;
        if (from == null || to == null || Math.abs(to - from) < 40) return;
        go(to < from ? page + 1 : page - 1);
      }}
      className="group relative bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ aspectRatio: ratio ? String(ratio) : "4 / 3", maxHeight: large ? "75vh" : undefined }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn("block h-full w-full object-contain transition-opacity", drawing && "opacity-60")}
      />

      {(!doc || drawing) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      {total > 1 && (
        <>
          <PageButton side="left" disabled={page <= 1} onClick={() => go(page - 1)} />
          <PageButton side="right" disabled={page >= total} onClick={() => go(page + 1)} />
        </>
      )}
      {total > 0 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-foreground/75 px-2 py-0.5 text-[11px] font-medium text-background" aria-live="polite">
          {page} / {total}
        </span>
      )}
    </div>
  );
}

function PageButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous page" : "Next page"}
      className={cn(
        "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-opacity hover:bg-card disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

export default DocumentViewer;
