import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { claimCommunityTab } from "@/lib/communityTab";
import { CommunityTopBar } from "./CommunityTopBar";
import { CommunityNav } from "./CommunityNav";

/**
 * The community as a place of its own.
 *
 * Its own top bar and its own nav, with no main-site header above them: the
 * main site opens this in a separate tab (see `COMMUNITY_TAB`), and every
 * community and marketplace page renders inside it. A layout route, so moving
 * between a space, a post and the marketplace swaps only the middle while the
 * bar and the nav stay put.
 */
export function CommunityShell() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    claimCommunityTab();
  }, []);

  // Choosing somewhere in the drawer is the end of using it.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background">
      <CommunityTopBar onOpenMenu={() => setMenuOpen(true)} />

      {/* Nav, page and rail as one block in the middle of the screen, the way
          X sits: on a wide monitor the nav stays beside what it steers rather
          than stranded at the left edge with the feed a long way off. The top
          bar's contents use the same width, so the two line up. */}
      <div className="mx-auto flex w-full max-w-[1280px]">
        {/* Sticky under the bar, scrolling on its own: the page scrolls past
            it, and anything below the fold would otherwise be unreachable. */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border lg:block">
          <CommunityNav />
        </aside>

        {/* Not a <main>: each page brings its own, and there is one per page. */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>

      {/* Below lg the nav is a drawer from the bar's menu button. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0 pt-10">
          <SheetTitle className="sr-only">Community menu</SheetTitle>
          <SheetDescription className="sr-only">Feeds, the marketplace and your spaces.</SheetDescription>
          <div className="min-h-0 flex-1">
            <CommunityNav />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default CommunityShell;
