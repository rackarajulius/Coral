import { Navigate, useLocation } from "react-router-dom";
import { SettingsShell, resolveSettingsTab } from "@/components/employer-dashboard/settings/settings";
import General from "@/components/employer-dashboard/settings/general";
import Security from "@/components/employer-dashboard/settings/security";
import Notifications from "@/components/employer-dashboard/settings/notifications";
import Templates from "@/components/employer-dashboard/settings/templates";
import AuditLogs from "@/components/employer-dashboard/settings/audit-logs";
import { SettingsTabId } from "@/components/employer-dashboard/settings/shared";

// Component references, not JSX instances — only the active tab is instantiated per render.
const TAB_COMPONENTS: Record<SettingsTabId, React.ComponentType> = {
  general:       General,
  security:      Security,
  notifications: Notifications,
  templates:     Templates,
  audit:         AuditLogs,
};

export default function SettingsPage() {
  const { pathname, search } = useLocation();

  // Integrations moved to its own page. Redirect rather than 404: the
  // "connect a calendar" next-action still emits the old path as a deep
  // link, and ?connect=1 has to survive the hop or it lands on nothing.
  if (pathname.startsWith("/employers/settings/integrations")) {
    return <Navigate to={`/employers/integrations${search}`} replace />;
  }

  // Team and roles moved to /employers/team for the same reason integrations
  // moved: who can see your candidates is not a preference. Both paths are in
  // the wild — the sidebar linked one and the "invite your team" nudge the
  // other — so they redirect rather than 404.
  if (pathname.startsWith("/employers/settings/team")) {
    return <Navigate to="/employers/team" replace />;
  }
  if (pathname.startsWith("/employers/settings/roles")) {
    return <Navigate to="/employers/team/roles" replace />;
  }

  if (pathname === "/employers/settings" || pathname === "/employers/settings/") {
    return <Navigate to="/employers/settings/general" replace />;
  }

  const tab = resolveSettingsTab(pathname);
  if (!tab) {
    return <Navigate to="/employers/settings/general" replace />;
  }

  const Panel = TAB_COMPONENTS[tab];
  return (
      <SettingsShell><Panel /></SettingsShell>
  );
}
