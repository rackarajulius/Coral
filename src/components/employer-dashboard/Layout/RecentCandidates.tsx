import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Stage = "Applied" | "Screening" | "Interview" | "Offer" | "Hired";

interface Candidate {
  name: string;
  role: string;
  stage: Stage;
  match: number;
  avatar: string;
}

const candidates: Candidate[] = [
  { name: "Sarah Chen", role: "Senior Frontend Engineer", stage: "Interview", match: 96, avatar: "SC" },
  { name: "Marcus Johnson", role: "Product Designer", stage: "Screening", match: 91, avatar: "MJ" },
  { name: "Emily Rodriguez", role: "Data Scientist", stage: "Offer", match: 94, avatar: "ER" },
  { name: "Alex Kim", role: "Backend Engineer", stage: "Interview", match: 89, avatar: "AK" },
  { name: "Priya Sharma", role: "DevOps Engineer", stage: "Applied", match: 87, avatar: "PS" },
  { name: "Noah Williams", role: "iOS Engineer", stage: "Interview", match: 92, avatar: "NW" },
  { name: "Léa Dubois", role: "UX Researcher", stage: "Screening", match: 88, avatar: "LD" },
  { name: "Diego Alvarez", role: "Backend Engineer", stage: "Applied", match: 84, avatar: "DA" },
  { name: "Yuki Tanaka", role: "Product Designer", stage: "Applied", match: 90, avatar: "YT" },
  { name: "Aisha Khan", role: "Data Engineer", stage: "Screening", match: 86, avatar: "AK" },
  { name: "Tom Becker", role: "Marketing Lead", stage: "Applied", match: 79, avatar: "TB" },
  { name: "Lina Rossi", role: "CS Manager", stage: "Offer", match: 93, avatar: "LR" },
  { name: "Omar Haddad", role: "Security Engineer", stage: "Applied", match: 82, avatar: "OH" },
  { name: "Hannah Park", role: "PM, Growth", stage: "Interview", match: 90, avatar: "HP" },
  { name: "Sofia Martins", role: "Senior Frontend Engineer", stage: "Hired", match: 97, avatar: "SM" },
  { name: "Ethan Wright", role: "Engineering Manager", stage: "Hired", match: 95, avatar: "EW" },
  { name: "Mei Lin", role: "Product Designer", stage: "Hired", match: 93, avatar: "ML" },
];

const STAGES: Stage[] = ["Applied", "Screening", "Interview", "Offer", "Hired"];

const stageStyles: Record<
  Stage,
  { badge: string; dot: string; ring: string; activeBg: string }
> = {
  Applied: {
    badge:
      "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
    dot: "bg-slate-400",
    ring: "ring-slate-300 dark:ring-slate-600",
    activeBg: "bg-slate-100 dark:bg-slate-800",
  },

  Screening: {
    badge:
      "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
    dot: "bg-blue-500",
    ring: "ring-blue-500/30",
    activeBg: "bg-blue-500/5",
  },

  Interview: {
    badge:
      "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400",
    dot: "bg-indigo-500",
    ring: "ring-indigo-500/30",
    activeBg: "bg-indigo-500/5",
  },

  Offer: {
    badge:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    activeBg: "bg-amber-500/5",
  },

  Hired: {
    badge:
      "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    activeBg: "bg-emerald-500/5",
  },
};

const MAX_VISIBLE = 4;
  

const RecentCandidates = () => {
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Stage | null>(null);

  const groups = STAGES.map((stage) => ({
    stage,
    members: candidates.filter((c) => c.stage === stage),
  })).filter((g) => g.members.length > 0);

  const visibleGroups = filter ? groups.filter((g) => g.stage === filter) : groups;
  const filteredCandidates = filter ? candidates.filter((c) => c.stage === filter) : candidates;

  return (
    <Card className="border-border bg-card shadow-elevation-sm">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h3 className="text-sm font-semibold">Applicants across all roles</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filter
              ? `Filtered by ${filter} · ${filteredCandidates.length} ${
                  filteredCandidates.length === 1 ? "candidate" : "candidates"
                }`
              : "Click a stage to filter"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {filter && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setFilter(null)}
            >
              Clear filter
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/employers/candidates")}>
            View all
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {visibleGroups.map(({ stage, members }) => {
          const styles = stageStyles[stage];
          const visible = members.slice(0, MAX_VISIBLE);
          const overflow = members.length - visible.length;
          const isActive = filter === stage;

          return (
            <button
              key={stage}
              type="button"
              onClick={() => setFilter(isActive ? null : stage)}
              aria-pressed={isActive}
              className={cn(
                "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
                "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && styles.activeBg,
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{stage}</p>
                    <Badge
                      variant="secondary"
                      className={cn("border-0 text-[11px] tabular-nums", styles.badge)}
                    >
                      {members.length}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {members.length === 1
                      ? `${members[0].name} · ${members[0].role}`
                      : `${members[0].name}, ${members[1]?.name ?? ""}${
                          members.length > 2 ? ` and ${members.length - 2} more` : ""
                        }`}
                  </p>
                </div>
              </div>

              <div className="flex items-center -space-x-2">
                {visible.map((m) => (
                  <div
                    key={m.name}
                    title={`${m.name} — ${m.role}`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-primary ring-2",
                      styles.ring,
                    )}
                  >
                    {m.avatar}
                  </div>
                ))}
                {overflow > 0 && (
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 tabular-nums",
                      styles.ring,
                    )}
                  >
                    +{overflow}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filter && (
        <div className="border-t border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filter} candidates
            </h4>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {filteredCandidates.length} total
            </span>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {filteredCandidates.map((c) => {
              const styles = stageStyles[c.stage];
              return (
                <div
                  key={c.name}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-primary ring-2",
                      styles.ring,
                    )}
                  >
                    {c.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.role}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("border-0 text-[11px] tabular-nums", styles.badge)}
                  >
                    {c.match}% match
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default RecentCandidates;
