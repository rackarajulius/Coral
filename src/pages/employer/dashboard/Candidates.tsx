import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, ArrowDownWideNarrow, Sparkles, LayoutGrid, List, Loader2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { CandidateDetailPanel } from "@/components/employer-dashboard/candidates/CandidateDetailDrawer";
import { CandidatesListView } from "@/components/employer-dashboard/candidates/CandidateListView";
import { CandidateKanbanView } from "@/components/employer-dashboard/candidates/CandidateKanbanView";
import { cn } from "@/lib/utils";
import { STAGES, STAGES_BEFORE_INTERVIEW, type Candidate, type Stage } from "@/data/employer/Candidates/types";
import { useCandidateStore } from "@/stores/candidateStore";
import { useMySeat } from "@/hooks/useMySeat";
import { getPipelineBoard } from "@/lib/api/employerCandidates";
import { getTagsInUse } from "@/lib/api/ats";
import { DRAWER_CLOSE_MS } from "@/components/employer-dashboard/candidates/candidateUtils";

/** One screenful; "Load more" pages through the rest. */
const PAGE_SIZE = 50;

export default function Candidates() {
  // ── Store ────────────────────────────────────────────────────────────────
  const { candidates, moveTo, reject, bulkMove, bulkReject, setStatus, scheduleInterview } = useCandidateStore();

  /**
   * Whether this seat may move people through the pipeline.
   *
   * The server has always refused these from a comment-only seat, but the board
   * offered them regardless — so an interviewer got a draggable board where
   * every drag failed with a toast. The interviewer seat exists so someone can
   * contribute without deciding; offering the decision and then refusing it
   * reads as a broken product rather than a boundary.
   */
  const { can } = useMySeat();
  const canMove = can("candidates:write");

  // ── Local UI state ────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<Candidate | null>(null);
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState(() => localStorage.getItem("cand:search") ?? "");
  const [debounced, setDebounced] = useState(search);
  const [jobFilter, setJobFilter] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cand:jobIds") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [sortKey, setSortKey] = useState<"match" | "recent">(
    () => (localStorage.getItem("cand:sort") as "match" | "recent") ?? "match"
  );
  /**
   * Which half of the pipeline to show.
   *
   * This board used to be applicants only; sourced candidates lived on a
   * separate screen with a separate vocabulary. They are one list now, and this
   * narrows it when a recruiter wants only the people who wrote in, or only the
   * people the team went out and found.
   */
  const [sourceFilter, setSourceFilter] = useState<"all" | "applied" | "sourced">(
    () => (localStorage.getItem("cand:source") as "all" | "applied" | "sourced") ?? "all",
  );

  const [stageFilter, setStageFilter] = useState<Set<Stage>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cand:stages") ?? "[]") as Stage[]);
    } catch {
      return new Set();
    }
  });
  /**
   * Tags to narrow by — "everyone we tagged Strong referral". A candidate
   * matches if they carry any of them. Stored lower-case, which is how the
   * server compares them.
   */
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cand:tags") ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const tagsInUse = useQuery({
    queryKey: ["tags-in-use"],
    queryFn: getTagsInUse,
    staleTime: 60_000,
    retry: false,
  });
  const [viewMode, setViewMode] = useState<"list" | "kanban">(
    () => (localStorage.getItem("cand:view") as "list" | "kanban") ?? "list"
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    localStorage.setItem("cand:search", search);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("cand:jobIds", JSON.stringify([...jobFilter]));
  }, [jobFilter]);

  useEffect(() => {
    localStorage.setItem("cand:sort", sortKey);
  }, [sortKey]);

  useEffect(() => {
    localStorage.setItem("cand:stages", JSON.stringify([...stageFilter]));
  }, [stageFilter]);

  useEffect(() => {
    localStorage.setItem("cand:source", sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    localStorage.setItem("cand:tags", JSON.stringify([...tagFilter]));
  }, [tagFilter]);

  useEffect(() => {
    localStorage.setItem("cand:view", viewMode);
  }, [viewMode]);

  // Landing back from the Google Calendar connect flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (!google) return;
    if (google === "connected") toast.success("Google Calendar connected", { description: "Video interviews will get a Meet link automatically." });
    else toast.error("Google Calendar connection failed");
    params.delete("google");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  /**
   * Applicants for the current filters, ranked by the server.
   *
   * Sorting used to happen here over the 200 most recent applications, which
   * meant "best match" only ever ranked the newest 200. The database does it
   * now, across the whole pipeline, so these are genuinely the top matches.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPipelineBoard({
      page: 1,
      limit: PAGE_SIZE,
      q: debounced,
      sort: sortKey,
      stages: [...stageFilter],
      jobIds: [...jobFilter],
      ...(sourceFilter === "all" ? {} : { source: sourceFilter }),
      tags: [...tagFilter],
    })
      .then((res) => {
        if (cancelled) return;
        useCandidateStore.getState().hydrate(res.candidates);
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load candidates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, sortKey, stageFilter, jobFilter, sourceFilter, tagFilter]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const res = await getPipelineBoard({
        page: page + 1,
        limit: PAGE_SIZE,
        q: debounced,
        sort: sortKey,
        stages: [...stageFilter],
        jobIds: [...jobFilter],
        ...(sourceFilter === "all" ? {} : { source: sourceFilter }),
        tags: [...tagFilter],
      });
      useCandidateStore.getState().append(res.candidates);
      setPage(res.page);
    } catch {
      toast.error("Couldn't load more candidates");
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  // Compute job filter options from live candidates (includes AI-sourced entries)
  // Job filter options carry ids now, because filtering happens server-side.
  const JOBS = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of candidates) if (c.jobId) byId.set(c.jobId, c.role);
    return [...byId].map(([id, title]) => ({ id, title }));
  }, [candidates]);

  /**
   * A second, local pass over what the server already returned.
   *
   * Redundant for applications — they arrive filtered and ranked — but the
   * store also holds candidates added straight from Talent Scout, which never
   * went through the server query. This narrows those to match. It is not where
   * ranking happens any more.
   */
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    let arr = stageFilter.size > 0
      ? candidates.filter((c) => stageFilter.has(c.stage))
      : candidates.filter((c) => c.stage !== "Rejected");
    if (q) {
      arr = arr.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.currentCompany.toLowerCase().includes(q)
      );
    }
    if (jobFilter.size > 0) arr = arr.filter((c) => !!c.jobId && jobFilter.has(c.jobId));
    if (tagFilter.size > 0) arr = arr.filter((c) => c.tags.some((t) => tagFilter.has(t.toLowerCase())));
    arr.sort((a, b) => {
      if (sortKey !== "match") {
        return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
      }
      // Null means the job listed no skills, so there is nothing to compare —
      // those sort last rather than arithmetically becoming NaN.
      const sa = a.matchScore ?? -1;
      const sb = b.matchScore ?? -1;
      return sb - sa;
    });
    return arr;
  }, [candidates, debounced, jobFilter, sortKey, stageFilter, tagFilter]);

  /**
   * Opens the candidate named in `?candidate=<id>`.
   *
   * A notification saying "Ada moved Sam to Interview" has to land on Sam, not
   * on a list of two hundred people with Sam somewhere in it. Waits for the
   * list to arrive, then opens the drawer and drops the parameter so a refresh
   * or a back-navigation does not keep reopening it.
   */
  const wanted = params.get("candidate");
  useEffect(() => {
    if (!wanted || candidates.length === 0) return;
    const found = candidates.find((c) => c.id === wanted);
    if (found) {
      setActive(found);
      setDrawerOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("candidate");
    setParams(next, { replace: true });
    // The id is what decides whether there is anything to do; `params` and the
    // setter change identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, candidates.length]);

  const totalActive = candidates.filter((c) => c.stage !== "Rejected").length;

  const jobCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      if (c.stage !== "Rejected") counts[c.role] = (counts[c.role] ?? 0) + 1;
    }
    return counts;
  }, [candidates]);

  const stageCounts = useMemo(() => {
    const counts: Partial<Record<Stage, number>> = {};
    for (const c of candidates) {
      if (c.stage !== "Rejected") counts[c.stage] = (counts[c.stage] ?? 0) + 1;
    }
    return counts;
  }, [candidates]);

  const rejectedCount = useMemo(
    () => candidates.filter((c) => c.stage === "Rejected").length,
    [candidates]
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
      <div className="space-y-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalActive} active —{" "}
              {STAGES.filter((s) => stageCounts[s]).map((s) => `${stageCounts[s]} in ${s}`).join(", ")}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSortKey("match"); toast.success("Ranked by AI match score"); }}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI auto-rank
          </Button>
        </div>

        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, email..."
              className="h-9 border border-border pl-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5" /> Job
                {jobFilter.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 border-0 bg-primary-soft px-1.5 text-[10px] text-primary"
                  >
                    {jobFilter.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by job</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {JOBS.map((j) => (
                <DropdownMenuCheckboxItem
                  key={j.id}
                  checked={jobFilter.has(j.id)}
                  onCheckedChange={(v) => {
                    setJobFilter((s) => {
                      const next = new Set(s);
                      if (v) next.add(j.id); else next.delete(j.id);
                      return next;
                    });
                  }}
                >
                  <span className="flex-1 truncate">{j.title}</span>
                  <span className="ml-3 tabular-nums text-xs text-muted-foreground">{jobCounts[j.title] ?? 0}</span>
                </DropdownMenuCheckboxItem>
              ))}
              {jobFilter.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={() => setJobFilter(new Set())}
                    className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <TagIcon className="h-3.5 w-3.5" /> Tags
                {tagFilter.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 border-0 bg-primary-soft px-1.5 text-[10px] text-primary"
                  >
                    {tagFilter.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(tagsInUse.data ?? []).length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No tags yet. Add them from a candidate's notes panel — for anything the stage doesn't
                  say, like "strong referral".
                </p>
              ) : (
                (tagsInUse.data ?? []).map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.label}
                    checked={tagFilter.has(t.label.toLowerCase())}
                    onCheckedChange={(v) => {
                      setTagFilter((s) => {
                        const next = new Set(s);
                        if (v) next.add(t.label.toLowerCase());
                        else next.delete(t.label.toLowerCase());
                        return next;
                      });
                    }}
                  >
                    <span className="flex-1 truncate">{t.label}</span>
                    <span className="ml-3 tabular-nums text-xs text-muted-foreground">{t.count}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {tagFilter.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={() => setTagFilter(new Set())}
                    className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear tag filter
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                {sortKey === "match" ? "AI Match" : "Most recent"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={sortKey === "match"}
                onCheckedChange={() => setSortKey("match")}
              >
                AI Match score
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortKey === "recent"}
                onCheckedChange={() => setSortKey("recent")}
              >
                Most recent
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/*
          Said once, plainly. Without it the board simply lacks controls other
          people describe having, which reads as something broken rather than a
          role working as intended.
        */}
        {!canMove && (
          <p className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Your seat can comment on candidates and run interviews, but not move
            them through the pipeline. Notes you leave are visible to the whole
            hiring team.
          </p>
        )}

        {/* Who is on the board, before which stage they are at. */}
        <div className="flex items-center gap-2 pb-1">
          {(
            [
              ["all", "Everyone"],
              ["applied", "Applied to us"],
              ["sourced", "We found them"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                sourceFilter === value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStageFilter(new Set())}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              stageFilter.size === 0
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
            )}
          >
            All · {totalActive}
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                setStageFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(s)) next.delete(s); else next.add(s);
                  return next;
                })
              }
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                stageFilter.has(s)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
              )}
            >
              {s} · {stageCounts[s] ?? 0}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setStageFilter((prev) => {
                const next = new Set(prev);
                if (next.has("Rejected")) next.delete("Rejected"); else next.add("Rejected");
                return next;
              })
            }
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              stageFilter.has("Rejected")
                ? "border-destructive bg-background text-destructive"
                : "border-border bg-background text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
            )}
          >
            Rejected · {rejectedCount}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : viewMode === "list" ? (
          <CandidatesListView
            candidates={filtered}
            onSelect={(c) => { setActive(c); setDrawerOpen(true); }}
            onBulkMove={bulkMove}
            onBulkReject={bulkReject}
            canMove={canMove}
            onClearFilters={() => { setSearch(""); setJobFilter(new Set()); setStageFilter(new Set()); }}
          />
        ) : (
          <CandidateKanbanView
            candidates={filtered}
            onSelect={(c) => { setActive(c); setDrawerOpen(true); }}
            onMoveTo={moveTo}
            onReject={reject}
            canMove={canMove}
          />
        )}

        {/* Says how much of the pipeline is on screen. The board used to show
            the newest 200 with no indication there were more. */}
        {total > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(filtered.length, total)} of {total} applicant{total === 1 ? "" : "s"}
            </p>
            {page < totalPages && (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Load more
              </Button>
            )}
          </div>
        )}

        <CandidateDetailPanel
          candidate={active}
          open={drawerOpen}
          onOpenChange={(open) => { setDrawerOpen(open); }}
          onClose={() => {
            setDrawerOpen(false);
            window.setTimeout(() => setActive(null), DRAWER_CLOSE_MS);
          }}
          canMove={canMove}
          onAdvance={(id, s) => {
            moveTo(id, s as Stage);
            setActive((prev) => (prev ? { ...prev, stage: s } : prev));
          }}
          onReject={(id) => {
            reject(id);
            setDrawerOpen(false);
            window.setTimeout(() => setActive(null), DRAWER_CLOSE_MS);
          }}
          onStatusChange={(id, status) => {
            setStatus(id, status);
            setActive((prev) => (prev ? { ...prev, status } : prev));
          }}
          onSchedule={(id, details) => {
            scheduleInterview(id, details);
            const shouldAdvance = STAGES_BEFORE_INTERVIEW.includes(active?.stage ?? "Applied");
            setActive((prev) =>
              prev ? { ...prev, stage: shouldAdvance ? "Interview" : prev.stage } : prev
            );
          }}
        />
      </div>
  );
}
