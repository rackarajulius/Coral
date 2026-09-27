import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TeamShell } from "@/components/employer-dashboard/team/TeamShell";
import { resolveTeamTab, teamTabs } from "@/components/employer-dashboard/team/tabs";
import TeamPeople from "@/components/employer-dashboard/team/TeamPeople";
import TeamRoles from "@/components/employer-dashboard/team/TeamRoles";
import JoinLinkCard from "@/components/employer-dashboard/team/JoinLinkCard";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getTeam } from "@/lib/api/companyTeam";

/**
 * Team: people, roles, and how new people get in.
 *
 * Its own page rather than a settings tab — see the note in
 * components/employer-dashboard/team/TeamShell.tsx. Settings keeps redirects
 * for the two paths that used to live there.
 */
export default function TeamPage() {
  const { pathname } = useLocation();
  useDocumentTitle("Team");

  /**
   * Shares the cache key `TeamPeople` uses, so the tab bar costs no extra
   * request. It is read here only for the company name and the two counts the
   * badges need.
   */
  const team = useQuery({ queryKey: ["company-team"], queryFn: getTeam, retry: false });

  const tab = resolveTeamTab(pathname);
  if (!tab) return <Navigate to="/employers/team" replace />;

  const tabs = teamTabs({
    // Until the team loads, assume the invite-link tab is not available rather
    // than showing a tab that then disappears under the pointer.
    canManage: team.data?.canManage ?? false,
    pending: team.data?.members.filter((m) => m.status === "PENDING").length ?? 0,
    invitations: team.data?.invitations.filter((i) => !i.expired).length ?? 0,
  });

  /**
   * A non-manager who deep-links to the invite link is sent to People rather
   * than shown an empty card. The link is a credential; the server refuses to
   * hand it over, and `JoinLinkCard` renders nothing on that refusal.
   */
  if (tab === "access" && team.isSuccess && !team.data.canManage) {
    return <Navigate to="/employers/team" replace />;
  }

  return (
    <TeamShell tabs={tabs} companyName={team.data?.companyName}>
      {tab === "people" && <TeamPeople />}
      {tab === "roles" && <TeamRoles />}
      {tab === "access" && <JoinLinkCard />}
    </TeamShell>
  );
}
