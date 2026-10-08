import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EMPLOYER_ACTIVE_TAB } from "@/lib/tabStyles";
import { SETTINGS_TABS, SettingsTabId } from "./shared";

type SettingsShellProps = {
  children: React.ReactNode;
};

export function SettingsShell({ children }: SettingsShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your company record, security, and what Coral emails on your behalf.
          </p>
        </div>
        <div className="top-14 z-10 border-b border-border bg-background/80 backdrop-blur">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar">
            {SETTINGS_TABS.map((t) => (
              <NavLink
                key={t.id}
                to={`/employers/settings/${t.path}`}
                className={({ isActive }) =>
                  
                  cn(
                    "flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    isActive
                      ? EMPLOYER_ACTIVE_TAB
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="pt-6 animate-in fade-in-50 duration-200">{children}</div>
      </div>
    </div>
  );
}

export function resolveSettingsTab(pathname: string): SettingsTabId | null {
  const segment = pathname.replace(/^\/employers\/settings\/?/, "").split("/")[0];
  if (!segment) return null;
  const match = SETTINGS_TABS.find((t) => t.path === segment);
  return match ? match.id : null;
}
