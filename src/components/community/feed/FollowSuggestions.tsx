import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, Building2, Layers, MapPin, PenLine, TrendingUp, UserPlus, Users, X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import {
  companyPath,
  dismissFollowSuggestion,
  getFollowSuggestions,
  initials,
  personPath,
  undoDismissFollowSuggestion,
  type FollowSuggestion,
  type FollowSuggestionReason,
  type FollowSuggestionTab,
} from "@/lib/api/community";
import { FollowToggle, PersonFollowButton } from "./PersonFollowButton";

/** Rows shown at a time; more appear as the reader nears the end, as X's list does. */
const STEP = 20;

/** Follow in a row: compact on a phone (no icon), so the name keeps its room. */
const ROW_FOLLOW = "h-8 shrink-0 px-3 sm:px-4 [&>svg]:hidden sm:[&>svg]:block";

/**
 * The Following page's suggestion tabs, modelled on X's "Who to follow"
 * (x.com/i/connect_people): flat rows of photo, name, the line under it and
 * Follow, one infinite list.
 *
 * Coral's differences: each row says why it is there, in one checkable line
 * ("Followed by Ada and 2 others you follow"), instead of X's unexplained
 * picks; ✕ closes a suggestion for good, with an undo; and professionals lead
 * to their services rather than a subscription.
 *
 * Following someone leaves their row in place, now saying Following, so the
 * list does not jump under the reader; the next visit leaves them out.
 */
export function FollowSuggestions({ tab }: { tab: FollowSuggestionTab }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Per account: one person's suggestions are never shown to the next to sign in here.
  const key = ["follow-suggestions", tab, user?.id ?? null];

  const suggestions = useQuery({
    queryKey: key,
    queryFn: () => getFollowSuggestions(tab),
    enabled: !!user,
    staleTime: 5 * 60_000,
    // Reshuffling while someone works down the list would lose their place.
    refetchOnWindowFocus: false,
    retry: false,
  });

  const rows = suggestions.data ?? [];
  const [shown, setShown] = useState(STEP);

  // Reveal the next screenful before the reader reaches the end.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= rows.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((n) => n + STEP);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, rows.length]);

  const put = (row: FollowSuggestion, index: number) =>
    queryClient.setQueryData<FollowSuggestion[]>(key, (old = []) =>
      old.some((r) => r.kind === row.kind && r.id === row.id) ? old : [...old.slice(0, index), row, ...old.slice(index)],
    );
  const drop = (row: FollowSuggestion) =>
    queryClient.setQueryData<FollowSuggestion[]>(key, (old = []) =>
      old.filter((r) => !(r.kind === row.kind && r.id === row.id)),
    );

  const dismiss = (row: FollowSuggestion, index: number) => {
    drop(row);
    const saved = dismissFollowSuggestion(row.kind, row.id);
    saved.catch((e) => {
      put(row, index);
      toast.error((e as Error).message);
    });
    toast(`We won't suggest ${row.name} again.`, {
      action: {
        label: "Undo",
        onClick: () => {
          put(row, index);
          // After the dismissal lands, never before: an undo that overtook it
          // would be deleted first and then written back.
          void saved
            .then(() => undoDismissFollowSuggestion(row.kind, row.id))
            .catch((e) => {
              drop(row);
              toast.error((e as Error).message);
            });
        },
      },
    });
  };

  if (suggestions.isLoading) return <SuggestionSkeleton />;

  if (suggestions.isError) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">Couldn't load suggestions</p>
          <p className="mt-1 text-sm text-destructive/90">{(suggestions.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void suggestions.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) return <NoSuggestions tab={tab} />;

  return (
    <section aria-labelledby="follow-suggestions-title" className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 id="follow-suggestions-title" className="px-4 pb-1 pt-4 text-lg font-semibold">
        Suggested for you
      </h2>
      <ul className="pb-2">
        {rows.slice(0, shown).map((row, index) => (
          <li key={`${row.kind}:${row.id}`}>
            <SuggestionRow row={row} professional={tab === "professionals"} onDismiss={() => dismiss(row, index)} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden="true" />
    </section>
  );
}

function SuggestionRow({
  row,
  professional,
  onDismiss,
}: {
  row: FollowSuggestion;
  professional: boolean;
  onDismiss: () => void;
}) {
  // A professional's name leads to what they offer; anyone else's to their community page.
  const href = professional ? `/providers/${row.id}` : row.kind === "company" ? companyPath(row.id) : personPath(row.id);
  const company = row.kind === "company";

  return (
    <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <Link to={href} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <Avatar className={company ? "h-10 w-10 rounded-lg" : "h-10 w-10"}>
          <AvatarImage src={row.imageUrl ?? ""} alt="" className={company ? "object-contain" : undefined} />
          <AvatarFallback className={company ? "rounded-lg bg-muted text-muted-foreground" : "bg-primary/10 text-xs text-primary"}>
            {company ? <Building2 className="h-5 w-5" aria-hidden="true" /> : initials(row.name)}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {/* The chips wrap under the name on a narrow screen rather than
                squeezing it down to a letter. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link to={href} className="max-w-full truncate text-sm font-semibold text-foreground hover:underline">
                {row.name}
              </Link>
              {company && <Chip>Company</Chip>}
              {/* As X's grey "Follows you" beside the handle. */}
              {row.reason?.kind === "follows_you" && <Chip>Follows you</Chip>}
            </div>
            {row.headline && (
              <p className="line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{row.headline}</p>
            )}
          </div>
          {company ? (
            <CompanyFollow pageId={row.id} followerCount={row.followerCount} />
          ) : (
            <PersonFollowButton
              personId={row.id}
              initial={{ isFollowing: false, followerCount: row.followerCount }}
              className={ROW_FOLLOW}
            />
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Not interested in ${row.name}`}
            title="Not interested"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {professional && (row.category || row.location) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[row.category, row.location].filter(Boolean).join(" · ")}
          </p>
        )}
        {row.reason && row.reason.kind !== "follows_you" && <Reason reason={row.reason} />}
        {professional && (
          <Link
            to={href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline"
          >
            View services <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

function CompanyFollow({ pageId, followerCount }: { pageId: string; followerCount: number }) {
  const follow = useFollowCompany({
    companyId: pageId,
    initialFollowerCount: followerCount,
    initialStatus: { isFollowing: false, followerCount },
  });
  return (
    <FollowToggle
      following={follow.isFollowing}
      pending={follow.isPending}
      onToggle={follow.toggle}
      className={ROW_FOLLOW}
    />
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>
  );
}

/** "Followed by Ada, Ben and 3 others you follow" — the same wording as a person's page. */
export function followedByText(names: string[], total: number): string {
  const shown = names.slice(0, Math.min(names.length, total));
  const others = total - shown.length;
  if (shown.length === 0) return `Followed by ${total} ${total === 1 ? "person" : "people"} you follow`;
  const list =
    others > 0
      ? shown.join(", ")
      : shown.length === 1
        ? shown[0]
        : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return others > 0 ? `Followed by ${list} and ${others} ${others === 1 ? "other" : "others"} you follow` : `Followed by ${list}`;
}

function Reason({ reason }: { reason: FollowSuggestionReason }) {
  const line = (Icon: React.ElementType, body: React.ReactNode) => (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{body}</span>
    </p>
  );
  switch (reason.kind) {
    case "followed_by":
      return line(Users, followedByText(reason.names, reason.total));
    case "space":
      return line(
        Layers,
        <>
          Active in{" "}
          <Link to={`/community/spaces/${reason.slug}`} className="font-medium text-foreground hover:underline">
            {reason.name}
          </Link>
        </>,
      );
    case "near_you":
      return line(MapPin, `Also in ${reason.place}`);
    case "popular":
      return line(TrendingUp, "Popular in the community");
    case "posting":
      return line(PenLine, "Posting in the community lately");
    default:
      return null;
  }
}

function SuggestionSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" aria-busy="true" aria-label="Loading suggestions">
      <Skeleton className="mb-3 h-5 w-40" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function NoSuggestions({ tab }: { tab: FollowSuggestionTab }) {
  const people = tab === "people";
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <UserPlus className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium">
        {people ? "No one to suggest yet" : "No professionals to suggest yet"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {people
          ? "Suggestions come from who you follow and the spaces you're in. Join a few spaces, or follow people from their posts, and this fills up."
          : "When people offer their work on Coral, the ones you don't follow yet show up here."}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
        {people ? (
          <Link to="/community/search?tab=spaces">Find spaces</Link>
        ) : (
          <Link to="/providers">Browse professionals</Link>
        )}
      </Button>
    </div>
  );
}

export default FollowSuggestions;
