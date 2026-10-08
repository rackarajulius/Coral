import {
  Briefcase,
  BarChart3,
  Building2,
  Settings,
  UsersRound,
  Bell,
  Star,
  Home,
  CreditCard,
  Telescope,
  MessageSquare,
  CalendarClock,
  Plug,
  Plus,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SidebarUserMenu } from "@/components/employer-dashboard/Layout/SidebarUserMenu";
import { SidebarNudge } from "@/components/employer-dashboard/Layout/SidebarNudge";
import { useNotifications } from "@/hooks/useNotifications";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  /** Which live counter, if any, belongs beside this row. */
  badge?: "notifications";
  /** A secondary "add" affordance, revealed when the pointer is anywhere in the nav. */
  add?: { to: string; label: string };
};

/**
 * Grouped by what an employer is trying to do, not by feature name.
 *
 * Twelve undifferentiated rows made every destination cost the same amount of
 * scanning. Clusters of three or four mean the eye can skip whole sections.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Hire",
    items: [
      { title: "Jobs", url: "/employers/jobs", icon: Briefcase },
      { title: "Candidates", url: "/employers/candidates", icon: UsersRound },
      { title: "Talent Scout", url: "/employers/hiring", icon: Telescope },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Chat", url: "/employers/chat", icon: MessageSquare },
      // "Availability" described the mechanism; this describes the job.
      { title: "Scheduling", url: "/employers/availability", icon: CalendarClock },
      { title: "Automations", url: "/employers/automations", icon: Timer },
      { title: "Notifications", url: "/employers/notifications", icon: Bell, badge: "notifications" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", url: "/employers/analytics", icon: BarChart3 },
      { title: "Reviews", url: "/employers/reviews", icon: Star },
    ],
  },
  {
    label: "Company",
    items: [
      { title: "Profile", url: "/employers/company", icon: Building2 },
      { title: "Team", url: "/employers/team", icon: UsersRound },
      // Surfaced rather than buried: connecting a calendar is something people
      // do early and then cannot find again.
      {
        title: "Integrations",
        url: "/employers/integrations",
        icon: Plug,
        add: { to: "/employers/integrations?connect=1", label: "Connect an integration" },
      },
      { title: "Billing", url: "/employers/billing", icon: CreditCard },
    ],
  },
];

export function EmployerSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { unreadCount } = useNotifications();

  /**
   * Which edges have content beyond them right now.
   *
   * Measured rather than always-on: masking both edges unconditionally would
   * dim the first and last rows of a list short enough not to scroll, which
   * reads as "disabled" rather than "there is more".
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      setEdges({
        top: el.scrollTop > 1,
        // 1px of slack: fractional scroll heights otherwise leave the bottom
        // permanently faded when the list is scrolled fully down.
        bottom: overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Catches the nudge card appearing or a group collapsing, both of which
    // change the scroll height without a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((c) => observer.observe(c));

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [collapsed]);

  const maskClass = edges.top && edges.bottom
    ? "nav-mask-both"
    : edges.top
      ? "nav-mask-top"
      : edges.bottom
        ? "nav-mask-bottom"
        : "";

  /**
   * Prefix matching, except for rows that live under another row's path.
   * Team and Integrations sit beneath /employers/settings, so a naive prefix
   * test would light up Settings at the same time.
   */
  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === "/employers/settings") {
      return (
        location.pathname.startsWith("/employers/settings") &&
        !NAV_GROUPS.some((g) =>
          g.items.some((i) => i.url !== path && location.pathname.startsWith(i.url)),
        )
      );
    }
    return location.pathname.startsWith(path + "/");
  };

  const rowClass = (active: boolean) =>
    cn(
      "transition-all duration-150 rounded-lg",
      active
        ? "bg-orange-500/10 font-medium text-orange-700 hover:bg-orange-500/15 hover:text-orange-700 active:bg-orange-500/15 active:text-orange-700 dark:text-orange-400 dark:hover:text-orange-400 dark:active:text-orange-400"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const badgeFor = (item: NavItem) =>
    item.badge === "notifications" && unreadCount > 0 ? unreadCount : null;

  return (
    <Sidebar collapsible="icon" className="!border-r-0">
      {/* Fixed: the brand is the way home, and it should not scroll away. */}
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-coral/10 text-coral">
            <Briefcase className="h-4 w-4" />
          </div>
          {!collapsed && (
            <Link to="/employers/dashboard">
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-tight text-foreground">Coral</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  employer
                </span>
              </div>
            </Link>
          )}
        </div>
      </SidebarHeader>

      {/* `group/nav` drives the hover-revealed add buttons: they appear when the
          pointer is anywhere in the nav, not only over their own row, so you can
          see what is actionable without hunting row by row.
          `no-scrollbar` keeps the overflow behaviour and drops the track — a
          permanent scrollbar in fixed chrome reads as clutter. */}
      <SidebarContent
        ref={scrollRef}
        className={cn("group/nav no-scrollbar transition-[mask-image]", maskClass)}
      >
        {/* Home sits outside any group — it is the way back, not a category. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <NavLink
                    to="/employers/dashboard"
                    end
                    className={rowClass(isActive("/employers/dashboard"))}
                    activeClassName=""
                  >
                    <Home className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Home</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {/* The primary action lives in the nav rather than behind the
                    Jobs page — posting a role is the thing employers come to
                    do, and it should never take two clicks to reach. */}
                {group.label === "Hire" && (
                  <SidebarMenuItem className="relative">
                    <SidebarMenuButton asChild tooltip="Post a job">
                      <Link
                        to="/employers/jobs/post"
                        className={cn(
                          "rounded-lg border border-coral/30 bg-coral/10 font-medium text-coral",
                          "transition-colors hover:bg-coral/20",
                        )}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Post a job</span>}
                      </Link>
                    </SidebarMenuButton>

                    {/* Trailing +, matching Integrations. Unlike that row this
                        one has nowhere else to go — the row *is* the create
                        action — so it repeats the destination rather than
                        inventing a flow that doesn't exist. Hidden from screen
                        readers for that reason: a second identical link would
                        only add noise. */}
                    {!collapsed && (
                      <Link
                        to="/employers/jobs/post"
                        tabIndex={-1}
                        aria-hidden="true"
                        className={cn(
                          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-coral/70",
                          "opacity-0 transition-opacity group-hover/nav:opacity-100",
                          "hover:bg-coral/20 hover:text-coral",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </SidebarMenuItem>
                )}

                {group.items.map((item) => {
                  const active = isActive(item.url);
                  const count = badgeFor(item);
                  return (
                    <SidebarMenuItem key={item.url} className="relative">
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink to={item.url} className={rowClass(active)} activeClassName="">
                          <span className="relative mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                            <item.icon className="h-4 w-4" />
                            {/* Collapsed leaves no room for a number, so the
                                dot still says "something is waiting". */}
                            {count !== null && collapsed && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral ring-2 ring-sidebar" />
                            )}
                          </span>
                          {!collapsed && (
                            <span className="flex-1 truncate">{item.title}</span>
                          )}
                          {!collapsed && count !== null && (
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                active ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" : "bg-coral/15 text-coral",
                              )}
                            >
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>

                      {/* Sits outside the NavLink, not inside it — nesting a
                          link within a link is invalid and the inner one would
                          not be reachable by keyboard. */}
                      {item.add && !collapsed && (
                        <Link
                          to={item.add.to}
                          aria-label={item.add.label}
                          title={item.add.label}
                          className={cn(
                            "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1",
                            "opacity-0 transition-opacity group-hover/nav:opacity-100",
                            // Always visible to keyboard users: an affordance
                            // that only exists on hover is unreachable without
                            // a pointer.
                            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            active
                              ? "text-orange-700 hover:bg-orange-500/15 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                              : "text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground",
                          )}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {/* Settings and the nudge scroll with the nav rather than being pinned.
            Only the account row is fixed — it is the one thing you need to
            reach from anywhere, and pinning more of the footer eats the space
            the nav needs on short viewports. */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    // Straight to the first tab: /employers/settings only
                    // redirects here anyway, and the hop costs a render.
                    to="/employers/settings/general"
                    className={rowClass(isActive("/employers/settings"))}
                    activeClassName=""
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="px-2 pb-2">
            <SidebarNudge />
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
