import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, Clock, Info, PenLine, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getBillingOverview, hasCompany } from "@/lib/api/billing";
import { getRoles, type CompanyRole, type TeamResponse } from "@/lib/api/companyTeam";

/**
 * The three numbers worth knowing before reading the list.
 *
 * Every one of them is measured. Seats come from the billing overview, which
 * counts ACTIVE members against the plan registry
 * (backend/src/billing/plan-entitlements.ts) — the same registry enforcement
 * reads, so this cannot advertise a limit that does not exist.
 */
export function TeamSummary({
  team,
  onShowRequests,
}: {
  team: TeamResponse;
  onShowRequests: () => void;
}) {
  /**
   * `GET /employers/billing/overview` carries no capability requirement, so a
   * Viewer sees their own team's seat count. The upgrade link is still gated on
   * `canManageBilling` from the same payload.
   *
   * The key matches the Billing page's exactly, on purpose: it invalidates
   * `["billing"]` after a plan change, and a key of our own would leave this
   * card quoting the old plan's seat limit until a reload.
   */
  const billing = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: getBillingOverview,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const roles = useQuery({
    queryKey: ["company-roles"],
    queryFn: getRoles,
    staleTime: 60 * 60 * 1000, // fixed set
    retry: false,
  });

  const active = team.members.filter((m) => m.status === "ACTIVE");
  const pending = team.members.filter((m) => m.status === "PENDING").length;
  const liveInvitations = team.invitations.filter((i) => !i.expired).length;

  /**
   * Who can advance or reject someone, counted from the server's capability
   * map rather than a list of role names kept here — a copy would go stale the
   * first time a role's capabilities change.
   */
  const writers = roles.data
    ? active.filter((m) =>
        roles.data
          .find((r) => r.role === (m.role as CompanyRole))
          ?.capabilities.includes("candidates:write"),
      ).length
    : null;

  const overview = billing.data && hasCompany(billing.data) ? billing.data : null;
  const seats = overview?.usage.seats;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* ── seats ──────────────────────────────────────────────────────── */}
        <Stat
          icon={Users}
          label="Seats used"
          /* Reconciles with the table below, which also lists suspended and
             pending people. Without this line a card reading 3 next to five
             rows looks broken. */
          hint="Active members. Suspended and pending people don't take a seat."
        >
          {billing.isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : seats ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">{seats.used}</span>
                <span className="text-sm text-muted-foreground">
                  {/* An em dash, not a number: unlimited has no ceiling. */}
                  / {seats.limit === null ? "—" : seats.limit}
                </span>
              </div>
              <SeatNote
                used={seats.used}
                limit={seats.limit}
                plan={overview!.plan.name}
                canManageBilling={overview!.canManageBilling}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {active.length} active {active.length === 1 ? "member" : "members"}
            </p>
          )}
        </Stat>

        {/* ── who is waiting ─────────────────────────────────────────────── */}
        <Stat
          icon={Clock}
          label="Awaiting you"
          hint="Nobody in this count has any access until you approve them."
        >
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-2xl font-semibold tabular-nums",
                pending > 0 && "text-amber-700 dark:text-amber-400",
              )}
            >
              {pending}
            </span>
            <span className="text-sm text-muted-foreground">
              {pending === 1 ? "request" : "requests"}
            </span>
          </div>
          {pending > 0 ? (
            <button
              type="button"
              onClick={onShowRequests}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              Review them
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {liveInvitations > 0
                ? `${liveInvitations} invitation${liveInvitations === 1 ? "" : "s"} sent, waiting on them`
                : "Nobody's waiting"}
            </p>
          )}
        </Stat>

        {/* ── who can change a decision ──────────────────────────────────── */}
        <Stat
          icon={PenLine}
          label="Can advance or reject"
          hint="Interviewers can comment on a candidate but not move them. Viewers can do neither."
        >
          {writers === null ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{writers}</span>
              <span className="text-sm text-muted-foreground">
                of {active.length} {active.length === 1 ? "member" : "members"}
              </span>
            </div>
          )}
        </Stat>
      </div>

      {/* Constant, and the most consequential thing about adding a colleague —
          so it is stated once here rather than only inside the invite dialog.
          See the Viewer note in backend/src/company/capabilities.ts. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Every seat here can read applications and CVs, whatever their role — that line is
          company membership, not the role within it.{" "}
          <NavLink to="/employers/team/roles" className="underline hover:text-foreground">
            See what each role can do
          </NavLink>
          .
        </span>
      </p>
    </div>
  );
}

/**
 * What being at or over the seat limit means.
 *
 * Deliberately says nothing about what happens next. Plan caps are only
 * refused while BILLING_ENFORCEMENT is on, and the browser is not told whether
 * it is — so "your next invite will be blocked" would be a guess. Stating the
 * fact is true either way.
 */
function SeatNote({
  used, limit, plan, canManageBilling,
}: {
  used: number;
  limit: number | null;
  plan: string;
  canManageBilling: boolean;
}) {
  if (limit === null) {
    return <p className="mt-1 text-xs text-muted-foreground">Unlimited on {plan}</p>;
  }
  if (used < limit) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {limit - used} left on {plan}
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
      {used > limit ? "Over" : "At"} the {plan} limit of {limit}.{" "}
      {canManageBilling && (
        <NavLink to="/employers/billing" className="underline">
          Compare plans
        </NavLink>
      )}
    </p>
  );
}

function Stat({
  icon: Icon, label, hint, children,
}: {
  icon: typeof Users;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2">{children}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">{hint}</p>
    </div>
  );
}
