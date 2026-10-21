import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileMenu from "@/components/ProfileMenu";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The community's own top bar.
 *
 * In place of the main site's header: this tab is for reading and posting, so
 * what sits up here is what you do in a community — post to it, see who
 * answered you. Searching lives at the head of the feed and on the search
 * page itself. The way back to the rest of the site is at the foot of the nav.
 */
export function CommunityTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  /**
   * "Create" is a request to the feed, carried in the URL.
   *
   * The composer belongs to the feed, so from anywhere else this brings the
   * feed back and opens it there. On the feed it keeps the slice you were
   * reading — posting from Showcase should not drop you on Home.
   */
  const create = () => {
    const next = new URLSearchParams(pathname === "/community" ? params : undefined);
    next.set("compose", "1");
    const to = `/community?${next}`;
    if (!isAuthenticated) {
      openAuth({ redirectTo: to });
      return;
    }
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-card">
      {/* The same width as the shell's centred block, so the logo sits over
          the nav and the avatar over the rail. */}
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open community menu"
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/community" className="flex shrink-0 items-center gap-2" aria-label={`${BRAND_NAME} Community home`}>
          <Briefcase className="h-6 w-6 text-coral" aria-hidden="true" />
          <span className="font-display text-xl font-semibold tracking-tight text-primary">{BRAND_NAME}</span>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Community</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Phones only: the way to search from a page that has no search
              box of its own, such as a space or a post. */}
          <Link
            to="/community/search"
            aria-label="Search the community"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>

          <Button variant="ghost" size="sm" onClick={create} className="gap-1.5 rounded-full px-2.5 sm:px-3">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Create</span>
            <span className="sr-only sm:hidden">Create a post</span>
          </Button>

          <NotificationBell />

          {/* While auth is still resolving on refresh, a neutral placeholder —
              never the Sign in button — so it doesn't flash. */}
          {isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          ) : isAuthenticated ? (
            <ProfileMenu />
          ) : (
            <Button size="sm" className="rounded-full" onClick={() => openAuth()}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default CommunityTopBar;
