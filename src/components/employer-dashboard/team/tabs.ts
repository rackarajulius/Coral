import { Link2, Shield, UsersRound, type LucideIcon } from "lucide-react";

export type TeamTabId = "people" | "roles" | "access";

export interface TeamTab {
  id: TeamTabId;
  label: string;
  to: string;
  icon: LucideIcon;
  /** NavLink `end`: only the index tab may match its parent path exactly. */
  end?: boolean;
  /** Rendered as a badge when non-zero; never shown as "0". */
  count?: number;
  /** Amber rather than grey — someone is waiting on the reader. */
  urgent?: boolean;
}

const PATHS: Record<TeamTabId, string> = {
  people: "/employers/team",
  roles: "/employers/team/roles",
  access: "/employers/team/access",
};

/**
 * Which sub-page a URL means.
 *
 * `/employers/team` and `/employers/team/people` are the same page: the sidebar
 * links the bare path, and a deep link people bookmark or paste may carry the
 * segment.
 */
export function resolveTeamTab(pathname: string): TeamTabId | null {
  const segment = pathname.replace(/^\/employers\/team\/?/, "").split("/")[0];
  if (!segment || segment === "people") return "people";
  if (segment === "roles") return "roles";
  if (segment === "access") return "access";
  return null;
}

export function teamTabs(options: {
  /** The invite link is a credential, so the tab is hidden from non-managers. */
  canManage: boolean;
  /** People who asked to join and hold no access until approved. */
  pending: number;
  /** Invitations sent but not yet accepted. */
  invitations: number;
}): TeamTab[] {
  const tabs: TeamTab[] = [
    {
      id: "people",
      label: "People",
      to: PATHS.people,
      icon: UsersRound,
      end: true,
      /**
       * Requests outrank invitations for the badge, and are amber: a request is
       * someone locked out and waiting on you, an invitation is waiting on them.
       * Falling back to the invitation count keeps the badge informative
       * without ever claiming urgency it cannot back up.
       */
      count: options.pending || options.invitations,
      urgent: options.pending > 0,
    },
    { id: "roles", label: "Roles", to: PATHS.roles, icon: Shield },
  ];
  if (options.canManage) {
    tabs.push({ id: "access", label: "Invite link", to: PATHS.access, icon: Link2 });
  }
  return tabs;
}
