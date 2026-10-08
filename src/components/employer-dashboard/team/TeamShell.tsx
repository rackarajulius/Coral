import { NavLink } from "react-router-dom";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EMPLOYER_ACTIVE_TAB } from "@/lib/tabStyles";
import type { TeamTab } from "./tabs";

/**
 * Team, on its own page rather than a settings tab.
 *
 * Who can see your candidates is not a preference, and it was reached through
 * Settings → Team Members → scroll, on a page titled "Settings & Team" that
 * also held email templates and audit retention. Integrations made the same
 * move for the same reason; see the redirect in pages/employer/dashboard/Settings.tsx.
 */
export function TeamShell({
  tabs,
  companyName,
  children,
}: {
  tabs: TeamTab[];
  /** Whose team this is. An employer can hold a seat in more than one company. */
  companyName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1320px] px-6 py-8 lg:px-10">
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <NavLink to="/employers/company">{companyName || "Company"}</NavLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Team</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who works here, what each of them can do, and how new people get in.
          </p>
        </div>

        <div className="border-b border-border bg-background/80 backdrop-blur">
          <nav className="no-scrollbar flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <NavLink
                key={t.id}
                to={t.to}
                // The index tab matches its parent path exactly, or every tab
                // would render as active while Roles or Invite link is open.
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? EMPLOYER_ACTIVE_TAB
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <t.icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
                {/* Only ever a real count. A zero badge points at nothing. */}
                {!!t.count && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 min-w-5 justify-center px-1.5 text-xs",
                      t.urgent && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {t.count}
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="animate-in fade-in-50 pt-6 duration-200">{children}</div>
      </div>
    </div>
  );
}
