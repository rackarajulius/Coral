import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bookmark, Briefcase, BriefcaseBusiness, CalendarDays, ChevronDown, Compass, FolderKanban, Heart, Home,
  Inbox, Layers, Loader2, MessagesSquare, Plus, ShieldCheck, Sparkles, Store, User as UserIcon, UserCheck, UsersRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
import { listReports, listSpaces, type Space } from "@/lib/api/community";
import { NewSpaceDialog } from "@/components/community/feed/NewSpaceDialog";
import { useSpaceMembership } from "@/components/community/feed/useSpaceMembership";
import { parseView, viewHref, type FeedViewId } from "./feedViews";

/** How many of your spaces the nav lists before "Show more". */
const RAIL_LIMIT = 30;

/**
 * The community's own navigation, in the shell's left column.
 *
 * Every row is a link, and what is lit comes from the URL — the nav sits
 * outside the page it steers, so the address is the only thing the two
 * share. Every row is also backed by a real page or query: there is no
 * Activity, Insights or Archive, because none of those exist and a nav full
 * of dead rows is the fastest way to make a product feel abandoned.
 *
 * Spaces lists the ones *you* joined, never all of them. The full list grows
 * with the platform; yours grows with your choices, which is the only version
 * of it that keeps fitting on a screen. The rest are found through Explore.
 */
export function CommunityNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);

  const view = parseView(new URLSearchParams(search).get("view"));
  const feedActive = (v: FeedViewId | null) => pathname === "/community" && view === v;
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const activeSlug = pathname.startsWith("/community/spaces/")
    ? decodeURIComponent(pathname.slice("/community/spaces/".length))
    : null;

  // Paged, with "Show more" loading the next batch in place. Its own key —
  // the composer's picker reads the first page as a plain query, and the two
  // cache shapes differ.
  const mine = useInfiniteQuery({
    queryKey: ["community-spaces", "mine", "rail"],
    queryFn: ({ pageParam }) => listSpaces({ scope: "mine", page: pageParam, limit: RAIL_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: !!user,
    retry: false,
  });
  const mineSpaces = mine.data?.pages.flatMap((p) => p.data) ?? [];

  /**
   * The fallback for an empty list.
   *
   * Signed out, or signed in with nothing joined yet, the section would
   * otherwise be a heading over nothing — and the first visit is exactly when
   * someone most needs to be shown where the conversation is.
   */
  const showPopular = !user || (mine.isSuccess && mineSpaces.length === 0);
  const popular = useQuery({
    queryKey: ["community-spaces", "popular"],
    queryFn: () => listSpaces({ scope: "popular", limit: 6 }),
    enabled: showPopular,
    retry: false,
  });

  const spacesShown = showPopular ? popular.data?.data ?? [] : mineSpaces;
  const spacesLoading = showPopular ? popular.isLoading : mine.isLoading;
  const mineTotal = mine.data?.pages[0]?.meta.total ?? 0;
  const hiddenCount = showPopular ? 0 : mineTotal - mineSpaces.length;

  /**
   * Moderation is shown only to people the server will actually let in.
   *
   * Asked by trying: there is no "am I a moderator" endpoint, and a 403 here
   * is a cheap, truthful answer. Failing quietly hides the row rather than
   * offering a door that does not open.
   */
  const canModerate = useQuery({
    queryKey: ["moderation-access"],
    queryFn: () => listReports("OPEN").then(() => true).catch(() => false),
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { ref: scrollRef, maskClass } = useScrollEdges<HTMLElement>();
  const offersServices = !user || user.role === "JOB_SEEKER" || user.role === "FREELANCER";

  return (
    <nav
      ref={scrollRef}
      aria-label="Community"
      className={cn(
        "h-full overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:thin]",
        maskClass,
      )}
    >
      <div className="space-y-0.5">
        <Row icon={Home} label="Home" to="/community" active={feedActive(null)} />
        {/* Signed in only: following is something you have done. */}
        {user && <Row icon={UserCheck} label="Following" to={viewHref("following")} active={feedActive("following")} />}
        <Row icon={MessagesSquare} label="Discussions" to={viewHref("discussion")} active={feedActive("discussion")} />
        <Row icon={Sparkles} label="Showcase" to={viewHref("showcase")} active={feedActive("showcase")} />
        <Row icon={BriefcaseBusiness} label="Opportunities" to={viewHref("opportunity")} active={feedActive("opportunity")} />
        <Row icon={Compass} label="Explore" to="/community/search" active={under("/community/search")} />
        <Row icon={CalendarDays} label="Tides" to="/community/tides" active={under("/community/tides")} />
        {/* Only for signed-in people: starting one makes you its moderator,
            which is not something an anonymous visitor can be. */}
        {user && <Row icon={Plus} label="Start a space" onClick={() => setNewSpaceOpen(true)} />}
      </div>

      <Section id="marketplace" title="Marketplace">
        <Row icon={UsersRound} label="Professionals" to="/providers" active={under("/providers")} />
        <Row icon={Store} label="Services" to="/services" active={under("/services")} />
        <Row icon={FolderKanban} label="Project work" to="/projects" active={under("/projects")} />
        {offersServices && <Row icon={UserIcon} label="Offer services" to="/provider" active={under("/provider")} />}
        {user && (
          <>
            <Row icon={Store} label="My listings" to="/marketplace/manage" active={under("/marketplace/manage")} />
            <Row icon={Inbox} label="Marketplace inbox" to="/marketplace/inbox" active={under("/marketplace/inbox")} />
          </>
        )}
      </Section>

      {/* Signed-out visitors can read everything and own none of it, so the
          personal rows are absent rather than present and empty. */}
      {user && (
        <Section id="you" title="You">
          <Row icon={Layers} label="My spaces" to={viewHref("my-spaces")} active={feedActive("my-spaces")} />
          <Row icon={Bookmark} label="Saved" to={viewHref("saved")} active={feedActive("saved")} />
          <Row icon={Heart} label="Liked" to={viewHref("liked")} active={feedActive("liked")} />
          <Row icon={UserIcon} label="Your posts" to={viewHref("mine")} active={feedActive("mine")} />
          {canModerate.data && (
            <Row icon={ShieldCheck} label="Moderation" to="/community/moderation" active={under("/community/moderation")} />
          )}
        </Section>
      )}

      <Section
        id="spaces"
        title={showPopular ? "Popular spaces" : "Your spaces"}
        action={
          user && (
            <button
              type="button"
              onClick={() => setNewSpaceOpen(true)}
              aria-label="Start a space"
              title="Start a space"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )
        }
      >
        {spacesLoading && (
          <div className="space-y-1.5 px-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 rounded" />)}
          </div>
        )}

        {spacesShown.map((space) => (
          <SpaceRow key={space.id} space={space} active={activeSlug === space.slug} />
        ))}

        {showPopular && popular.isSuccess && (
          <p className="mt-2 px-2.5 text-xs leading-relaxed text-muted-foreground">
            {user && "Join a space and it stays here. "}
            <Link to="/community/search?tab=spaces" className="text-link hover:underline">
              Find more
            </Link>
          </p>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => void mine.fetchNextPage()}
            disabled={mine.isFetchingNextPage}
            className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-link hover:underline"
          >
            {mine.isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Show {Math.min(hiddenCount, RAIL_LIMIT)} more
          </button>
        )}
      </Section>

      {/* The way back. This tab was opened from the main site, which is
          usually still open in the tab before it, but a shared link can land
          someone here first. */}
      <div className="mt-4 space-y-3 border-t border-border px-2.5 pt-4 text-xs text-muted-foreground">
        <Link to="/" className="flex items-center gap-2 text-sm hover:text-foreground">
          <Briefcase className="h-4 w-4 text-coral" aria-hidden="true" />
          {BRAND_NAME} home
        </Link>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link to="/jobs" className="hover:text-foreground">Find jobs</Link>
          <Link to="/companies" className="hover:text-foreground">Companies</Link>
          <Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms-of-service" className="hover:text-foreground">Terms</Link>
        </div>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </div>

      <NewSpaceDialog
        open={newSpaceOpen}
        onClose={() => setNewSpaceOpen(false)}
        // Opens straight into it — you made it because you had something to
        // say there.
        onCreated={(space) => navigate(`/community/spaces/${space.slug}`)}
      />
    </nav>
  );
}

/* -------------------------------- sections -------------------------------- */

const COLLAPSED_KEY = "coral.community.nav.collapsed";

function readCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * A titled group that folds away.
 *
 * Which ones you folded is remembered in this browser — a convenience, so a
 * lost value just means the section opens again.
 */
function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => !readCollapsed().includes(id));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      const rest = readCollapsed().filter((v) => v !== id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next ? rest : [...rest, id]));
    } catch {
      // Storage refused; the section still folds for this visit.
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between pr-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex flex-1 items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {title}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")}
            aria-hidden="true"
          />
        </button>
        {action && <span className="ml-1">{action}</span>}
      </div>
      {open && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}

/**
 * Which edges of a scroller have content beyond them, as a mask class.
 *
 * Measured rather than always-on: fading both edges of a list short enough not
 * to scroll dims its first and last rows, which reads as "disabled" rather
 * than "there is more". Same approach as the employer sidebar.
 */
function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      setEdges({
        top: overflowing && el.scrollTop > 1,
        bottom: overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Lists arriving, a space being joined, a section folding or the viewport
    // changing all alter the scroll height without a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((c) => observer.observe(c));

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  const maskClass = edges.top && edges.bottom
    ? "nav-mask-both"
    : edges.top
      ? "nav-mask-top"
      : edges.bottom
        ? "nav-mask-bottom"
        : "";

  return { ref, maskClass };
}

/* ---------------------------------- rows ---------------------------------- */

function Row({
  icon: Icon,
  label,
  active,
  onClick,
  to,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
    active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

  const body = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {label}
    </>
  );

  return to ? (
    <Link to={to} className={className} aria-current={active ? "page" : undefined}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{body}</button>
  );
}

/**
 * A space, with joining folded into the row.
 *
 * The action sits on the right and only appears on hover — a column of
 * buttons competes with the names, and the name is what you came to read.
 * Under "Your spaces" every row is joined, so a permanent "Joined" label would
 * be the same word thirty times; the row offers "Leave" on hover instead.
 */
function SpaceRow({ space, active }: { space: Space; active: boolean }) {
  const { user } = useAuth();
  const toggle = useSpaceMembership(space);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      {/* A link, not a filter: a space has its own address, and that URL is
          the thing someone can send to a friend or a search engine. */}
      <Link
        to={`/community/spaces/${space.slug}`}
        title={space.name}
        aria-current={active ? "page" : undefined}
        className={cn(
          "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {space.name}
      </Link>

      {user && (
        <button
          type="button"
          onClick={() => toggle.mutate(!space.joined)}
          disabled={toggle.isPending}
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            space.joined ? "text-muted-foreground hover:text-foreground" : "text-link",
            toggle.isPending && "opacity-100",
          )}
        >
          {toggle.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : space.joined ? (
            "Leave"
          ) : (
            "Join"
          )}
        </button>
      )}
    </div>
  );
}

export default CommunityNav;
