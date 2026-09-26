import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Check, Loader2, PencilLine, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getMyApplications } from "@/lib/api/applications";
import type { Application } from "@/data/jobactivity/job-activity-mock";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import StepResume from "./StepResume";

export default function StepRole() {
  const role = useInterviewSetupStore((s) => s.config.role);
  const set = useInterviewSetupStore((s) => s.set);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");

  // Prep should follow the jobs you actually applied to, so pull them first.
  useEffect(() => {
    let cancelled = false;
    getMyApplications()
      .then((apps) => {
        if (cancelled) return;
        setApplications(apps);
        // Nothing to pick from → fall straight through to free text.
        if (apps.length === 0) setManual(true);
      })
      .catch(() => {
        if (!cancelled) setManual(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (a) => a.job.toLowerCase().includes(q) || a.company.toLowerCase().includes(q),
    );
  }, [applications, search]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-dim">
            {manual ? "Job title" : "Which role are you preparing for?"}
          </label>
          {applications.length > 0 && (
            <button
              type="button"
              onClick={() => setManual((m) => !m)}
              className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:underline"
            >
              {manual ? (
                <>
                  <Briefcase className="h-3 w-3" /> Pick from applications
                </>
              ) : (
                <>
                  <PencilLine className="h-3 w-3" /> Enter a different role
                </>
              )}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-4 py-6 text-sm text-ink-dim">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the jobs you've applied to…
          </div>
        ) : manual ? (
          <>
            <Input
              id="target-role"
              value={role ?? ""}
              onChange={(e) => set({ role: e.target.value })}
              placeholder="e.g. Frontend Engineer"
              autoComplete="off"
              className="h-12 border-ink/15 bg-surface text-base text-ink placeholder:text-ink-dim focus-visible:ring-coral"
            />
            {applications.length === 0 && (
              <p className="mt-2 text-xs text-ink-dim">
                Once you{" "}
                <Link to="/jobs" className="text-coral hover:underline">
                  apply to jobs
                </Link>
                , you can prep for them directly here.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {applications.length > 4 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your applications…"
                  className="h-9 border-ink/15 bg-surface pl-9 text-sm text-ink placeholder:text-ink-dim focus-visible:ring-coral"
                />
              </div>
            )}

            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-0.5">
              {visible.map((a) => {
                const selected = role === a.job;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => set({ role: a.job })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                      selected
                        ? "border-coral bg-coral/10"
                        : "border-ink/10 bg-surface hover:border-ink/25",
                    )}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-semibold text-ink">
                      {a.company.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{a.job}</span>
                      <span className="block truncate text-xs text-ink-dim">
                        {a.company} · {a.status}
                      </span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-coral" />}
                  </button>
                );
              })}

              {visible.length === 0 && (
                <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-6 text-center text-xs text-ink-dim">
                  No applications match “{search}”.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resume upload */}
      <div>
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-dim">Resume</p>
        <StepResume />
      </div>
    </div>
  );
}
