import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SectionCard } from "../settings/shared";
import { getRoles, ROLE_LABELS, type CompanyRole, type RoleReference } from "@/lib/api/companyTeam";

/**
 * What each role can do.
 *
 * Read-only and generated from the server's enforced capability map, not from a
 * copy kept in the UI. The previous version of this page was an editable grid
 * of switches that granted nothing — a permissions screen that lies is worse
 * than no permissions screen, because people plan access around it.
 */

/** Grouped for reading; every capability listed here is one the server checks. */
const AREAS: { label: string; capabilities: { key: string; label: string }[] }[] = [
  {
    label: "Jobs",
    capabilities: [
      { key: "jobs:read", label: "View jobs" },
      { key: "jobs:write", label: "Post and edit jobs" },
    ],
  },
  {
    label: "Candidates",
    capabilities: [
      { key: "candidates:read", label: "View applications and CVs" },
      { key: "candidates:comment", label: "Leave notes on a candidate" },
      { key: "candidates:write", label: "Advance, reject, screen" },
    ],
  },
  {
    label: "Interviews",
    capabilities: [
      { key: "interviews:read", label: "View interviews" },
      { key: "interviews:write", label: "Schedule and score" },
    ],
  },
  {
    label: "Communication",
    capabilities: [{ key: "messaging:write", label: "Message candidates" }],
  },
  {
    label: "Company",
    capabilities: [
      { key: "analytics:read", label: "View analytics" },
      { key: "company:write", label: "Edit company profile" },
      { key: "integrations:manage", label: "Manage integrations" },
      { key: "members:manage", label: "Manage team members" },
      { key: "billing:manage", label: "Manage billing" },
    ],
  },
];

const ORDER: CompanyRole[] = ["OWNER", "ADMIN", "RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "VIEWER"];

export default function RolesPermissions() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["company-roles"],
    queryFn: getRoles,
    staleTime: 60 * 60 * 1000, // fixed set — no reason to refetch
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-[520px] rounded-2xl" />;
  if (isError || !data) {
    return (
      <SectionCard title="Roles and permissions" description="What each role can do.">
        <p className="py-8 text-center text-sm text-muted-foreground">
          {(error as Error)?.message || "Couldn't load roles."}
        </p>
      </SectionCard>
    );
  }

  const byRole = new Map<CompanyRole, RoleReference>(data.map((r) => [r.role, r]));
  const roles = ORDER.filter((r) => byRole.has(r));
  const has = (role: CompanyRole, capability: string) =>
    byRole.get(role)?.capabilities.includes(capability) ?? false;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Roles and permissions"
        description="A fixed set of roles, enforced on every request. Change someone's role from the People tab."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Permission</TableHead>
                {roles.map((r) => (
                  <TableHead key={r} className="whitespace-nowrap text-center">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {AREAS.map((area) => (
                <Fragment key={area.label}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={roles.length + 1}
                      className="bg-secondary/40 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {area.label}
                    </TableCell>
                  </TableRow>
                  {area.capabilities.map((cap) => (
                    <TableRow key={cap.key}>
                      <TableCell className="text-sm">{cap.label}</TableCell>
                      {roles.map((r) => (
                        <TableCell key={r} className="text-center">
                          {has(r, cap.key) ? (
                            <Check
                              className="mx-auto h-4 w-4 text-[hsl(var(--status-active))]"
                              aria-label="Allowed"
                            />
                          ) : (
                            <span className="text-muted-foreground/40" aria-label="Not allowed">
                              —
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="What each role is for" description="Pick the narrowest one that lets someone do their job.">
        <div className="space-y-3">
          {roles.map((r) => {
            const ref = byRole.get(r)!;
            return (
              <div key={r} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{ref.label}</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {ref.capabilities.length} permission{ref.capabilities.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{ref.description}</p>
                {/* Stated openly: a role page implying a limit we don't enforce
                    is exactly the kind of thing people plan access around. */}
                {ref.limitation && (
                  <p
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-lg p-2.5 text-xs",
                      "bg-amber-500/5 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {ref.limitation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
