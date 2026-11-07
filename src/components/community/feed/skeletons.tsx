import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like what they stand in for.
 *
 * Each mirrors the real component's padding and proportions — avatar, byline,
 * text, footer — so the page does not jump when content arrives, and a reader
 * can already tell a post from a space from a tide while it loads. The shapes
 * are decoration; one polite status line tells assistive tech what is going on.
 */

/** Wraps a group of placeholders with a single announcement. */
function Loading({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {/* Layout classes live here, so spacing applies to the cards themselves. */}
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------- posts --------------------------------- */

/**
 * Text line widths: full, nearly full, two-thirds — a short paragraph's shape
 * rather than a stack of identical bars.
 */
const LINES = ["w-full", "w-11/12", "w-2/3"];

/**
 * One post card, as `FeedPost` lays it out.
 *
 * Every card in a loading list is this same shape, on purpose: one calm,
 * repeated placeholder reads as "posts are coming", where varied ones (some
 * with picture blocks) read as content that is half there.
 */
export function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 pb-3 pt-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>

      <div className="mt-4 space-y-2">
        {LINES.map((width, i) => (
          <Skeleton key={i} className={cn("h-3", width)} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

/** A column of posts loading. */
export function PostListSkeleton({ count = 3, label = "Loading posts" }: { count?: number; label?: string }) {
  return (
    <Loading label={label} className="block space-y-2">
      {Array.from({ length: count }, (_, i) => <PostSkeleton key={i} />)}
    </Loading>
  );
}

/** A single post with its thread open — what a permalink lands on. */
export function PermalinkSkeleton() {
  return (
    <Loading label="Loading post" className="block">
      <div className="rounded-2xl border border-border bg-card px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          {LINES.map((width, i) => <Skeleton key={i} className={cn("h-3", width)} />)}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-14 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <div className="mt-4">
            <CommentRowsSkeleton count={2} />
          </div>
        </div>
      </div>
    </Loading>
  );
}

/* -------------------------------- comments -------------------------------- */

function CommentRowsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <Skeleton className={cn("h-3", i % 2 ? "w-20" : "w-28")} />
            <Skeleton className={cn("h-3", i % 2 ? "w-1/2" : "w-4/5")} />
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Replies loading under a post, as `CommentThread` lays them out. */
export function CommentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading label="Loading comments" className="block py-3">
      <CommentRowsSkeleton count={count} />
    </Loading>
  );
}

/* --------------------------------- spaces --------------------------------- */

/** A space's banner card, as `SpaceHeader` lays it out. */
export function SpaceHeaderSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
        <div className="mt-4 flex gap-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

/** A whole space opening: its header, the composer prompt, then posts. */
export function SpaceViewSkeleton() {
  return (
    <Loading label="Loading space" className="block">
      <SpaceHeaderSkeleton />
      <div className="my-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      <div className="space-y-2">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </Loading>
  );
}

/** Rows in a list of spaces: thumbnail, name, owner, size. */
export function SpaceRowsSkeleton({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <Loading label="Loading spaces" className="block">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 pl-5">
          <Skeleton className="mt-4 h-10 w-10 shrink-0 rounded-xl" />
          <div className={cn("min-w-0 flex-1 border-b border-border pr-5 last:border-b-0", compact ? "py-3" : "py-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className={cn("h-3.5", i % 2 ? "w-28" : "w-40")} />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-[5.5rem] rounded-lg" />
            </div>
            {!compact && <Skeleton className="mt-3 h-3 w-4/5" />}
            <Skeleton className={cn("h-3 w-32", compact ? "mt-2" : "mt-3")} />
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** Names in the rail's space list. */
export function RailSpacesSkeleton() {
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-3/5"];
  return (
    <Loading label="Loading spaces" className="block space-y-0.5">
      {widths.map((width, i) => (
        <div key={i} className="px-2.5 py-2">
          <Skeleton className={cn("h-3.5", width)} />
        </div>
      ))}
    </Loading>
  );
}

/* ---------------------------------- tides --------------------------------- */

/** One tide card, as `TideCard` lays it out. */
export function TideCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", compact ? "p-3" : "p-4")}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      {!compact && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
}

export function TideListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading label="Loading tides" className="block space-y-3">
      {Array.from({ length: count }, (_, i) => <TideCardSkeleton key={i} />)}
    </Loading>
  );
}

/** The tide inside a post that announced it — a lighter card in the same place. */
export function TideEmbedSkeleton() {
  return (
    <Loading label="Loading tide" className="mt-3 block">
      <TideCardSkeleton compact />
    </Loading>
  );
}

/* ------------------------------ right sidebar ----------------------------- */

/** Icon-and-two-lines rows, for the sidebar's tides and spaces. */
export function SidebarRowsSkeleton({ count = 3, label }: { count?: number; label: string }) {
  return (
    <Loading label={label} className="block space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 p-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <Skeleton className={cn("h-3.5", i % 2 ? "w-2/3" : "w-5/6")} />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </Loading>
  );
}
