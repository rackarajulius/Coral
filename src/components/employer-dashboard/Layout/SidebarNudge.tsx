import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Send, X, type LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { getNextActions } from "@/lib/api/employerNextActions";
import { getTeam } from "@/lib/api/companyTeam";

/**
 * One prompt in the sidebar footer, or nothing at all.
 *
 * Deliberately not a fixed marketing card. Everything shown here is derived
 * from live state, so it disappears the moment it stops being true — a card
 * that always says the same thing stops being read within a day.
 *
 * It also defers to the dashboard: `NextBestActions` and `FinishSetupCard`
 * already surface these signals there, and saying the same thing three times on
 * one screen reads as nagging rather than helping.
 */

/**
 * Only "someone is waiting on you" earns a permanent slot in the chrome.
 *
 * The server's rules run from 100 down to 20. At 90 this admits unread
 * messages, an interview within 24h, applications sitting unopened and screens
 * awaiting review — four things with a person on the other end. Everything
 * below is optimisation advice (a job missing skills, drafts left unposted),
 * which belongs on the dashboard where it can be read once and acted on, not in
 * a frame that follows you around every page.
 */
const PRIORITY_FLOOR = 90;
const DISMISS_KEY = "coral.sidebarNudge.dismissed";

function dismissedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function dismiss(id: string) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...new Set([...dismissedIds(), id])]));
  } catch {
    // A full or blocked localStorage shouldn't break the sidebar.
  }
}

export function SidebarNudge() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState<string[]>(dismissedIds);

  const onDashboard = location.pathname === "/employers/dashboard";

  const actions = useQuery({
    queryKey: ["employer-next-actions"],
    queryFn: getNextActions,
    retry: false,
    staleTime: 60_000,
    enabled: !onDashboard,
  });

  // Used for the team prompt below. Cheap and already cached by the Team tab.
  const team = useQuery({
    queryKey: ["company-team"],
    queryFn: getTeam,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (onDashboard) return null;

  const hide = (id: string) => {
    dismiss(id);
    setDismissed((d) => [...d, id]);
  };

  // A real blocking action outranks anything else — an unverified company that
  // cannot post a job needs to hear that, not a suggestion about teammates.
  const urgent = (actions.data ?? [])
    .filter((a) => a.priority >= PRIORITY_FLOOR && !dismissed.includes(a.id))
    .sort((a, b) => b.priority - a.priority)[0];

  if (urgent) {
    const Icon = (Icons as unknown as Record<string, LucideIcon>)[urgent.icon] ?? Send;
    return (
      <Card
        id={urgent.id}
        icon={Icon}
        title={urgent.title}
        body={urgent.desc}
        cta={urgent.cta}
        to={urgent.to}
        onDismiss={hide}
      />
    );
  }

  // Nobody has ever been invited and there is still only one seat. Shown to
  // owners and admins only, since nobody else can act on it.
  const t = team.data;
  const soloCompany =
    !!t && t.canManage && t.members.length === 1 && t.invitations.length === 0;

  if (soloCompany && !dismissed.includes("invite-team")) {
    return (
      <Card
        id="invite-team"
        icon={Send}
        title="Invite your team"
        body="Share your jobs, candidates and messages with colleagues."
        cta="Add someone"
        to="/employers/settings/team"
        onDismiss={hide}
      />
    );
  }

  return null;
}

function Card({
  id, icon: Icon, title, body, cta, to, onDismiss,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
  to: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-muted/40 p-3">
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label={`Dismiss: ${title}`}
        className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>

      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background">
        <Icon className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
      </span>

      <p className="mt-2 pr-4 text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{body}</p>

      <Link
        to={to}
        className={cn(
          "mt-2 inline-block text-[11px] font-medium text-coral",
          "underline-offset-4 hover:underline",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

export default SidebarNudge;
