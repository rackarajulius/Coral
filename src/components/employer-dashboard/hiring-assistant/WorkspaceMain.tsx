import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Users, GitBranch, FileText, Download, Search, X, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/employer-dashboard/hiring-assistant/Section";
import { RoleSummary } from "./RoleSummary";
import { QualList } from "./QualList";
import { CandidateCard, CandidateSkeleton } from "./CandidateCard";
import { FiltersBar } from "./FiltersBar";
import { PipelineStats } from "./PipelineStats";
import { PipelineBoard } from "./PipelineBoard";
import { JobDescription } from "./JobDescription";
import { OutreachDialog } from "./OutreachDialog";
import { CandidateProfileSheet } from "./CandidateProfileSheet";
import { pipelineStages } from "@/data/employer/HiringAssistant/constants";
import { useCandidateStore } from "@/stores/candidateStore";
import { buildFilterGroups } from "@/data/employer/HiringAssistant/intentParser";
import { useSourcedCandidates } from "@/hooks/useSourcedCandidates";
import { formatPool } from "@/lib/api/hiring";
import { useContactedCandidates } from "@/hooks/useContactedCandidates";
import { useMySeat } from "@/hooks/useMySeat";
import { RefineSearchPanel } from "./RefineSearchPanel";
import { activeCriteriaCount, useSearchCriteria } from "@/stores/searchCriteriaStore";
import { useRoleProfile } from "@/hooks/useRoleProfile";
import { useShortlist } from "@/hooks/useShortlist";
import { useProjects } from "@/hooks/useProjects";
import { ProjectPicker } from "./ProjectPicker";
import { projectLabel } from "@/lib/api/shortlist";
import type { ShortlistStage } from "@/lib/api/shortlist";
import {
  REVEAL,
  promptToRoleTitle,
  type Candidate,
  type PipelineCandidate,
  type PipelineStage,
  type WorkspaceTab,
  type ParsedIntent,
  type JobDescriptionContent,
} from "@/data/employer/HiringAssistant/Index";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportPipelineCSV(candidates: PipelineCandidate[], stages: PipelineStage[]) {
  const stageLabel = (id: string) => stages.find((s) => s.id === id)?.label ?? id;
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const headers = ["Name", "Role", "Company", "Location", "Match Score", "Skills", "Stage", "Added"];
  const rows = candidates.map((c) => [
    c.name, c.role, c.company, c.location,
    `${c.match}%`, c.skills.join(" · "), stageLabel(c.stageId), c.addedAt,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hiring-pipeline.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Generating progress indicator (5.4) ─────────────────────────────────────

/**
 * Steps 0–1 are local (parsing + role profile) and finish immediately; steps 2–4
 * describe the real sourcing request, so they only tick over when it actually
 * resolves — never on a timer.
 */
const GENERATE_STEPS = [
  "Parsing your hiring intent",
  "Building role profile",
  "Matching candidates",
  "Ranking by fit score",
  "Assembling workspace",
];
const LOCAL_STEPS = 2;

function GeneratingIndicator({ sourcing, failed }: { sourcing: boolean; failed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-8 py-24 animate-fade-in">
      <div className="space-y-3.5">
        {GENERATE_STEPS.map((label, i) => {
          // Local steps are genuinely done; network steps wait on the real request.
          const done = i < LOCAL_STEPS || (!sourcing && !failed);
          const active = i >= LOCAL_STEPS && sourcing;
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-all duration-500",
                  done   ? "bg-accent"
                  : active ? "animate-pulse bg-accent/60"
                  :          "bg-muted"
                )}
              />
              <span
                className={cn(
                  "text-sm transition-colors duration-300",
                  done   ? "text-foreground"
                  : active ? "text-muted-foreground"
                  :          "text-muted-foreground/40"
                )}
              >
                {label}
                {done && (
                  <span className="ml-1.5 text-accent text-[11px]">✓</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Smart empty state (5.5) ──────────────────────────────────────────────────

function candidateMatchesFilter(c: Candidate, f: string) {
  return (
    c.location.toLowerCase().includes(f.toLowerCase()) ||
    c.skills.some((s) => s.toLowerCase().includes(f.toLowerCase())) ||
    (f === "3–5 yrs" && c.yearsExp >= 3 && c.yearsExp < 5) ||
    (f === "5–8 yrs" && c.yearsExp >= 5 && c.yearsExp <= 8) ||
    (f === "8+ yrs" && c.yearsExp > 8)
  );
}

interface SmartEmptyStateProps {
  activeFilters: string[];
  candidateSearch: string;
  allCandidates: Candidate[];
  /** How many server-side criteria are narrowing the pool itself. */
  criteriaCount: number;
  onToggleFilter: (f: string) => void;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onClearCriteria: () => void;
}

function SmartEmptyState({
  activeFilters,
  candidateSearch,
  allCandidates,
  criteriaCount,
  onToggleFilter,
  onClearFilters,
  onClearSearch,
  onClearCriteria,
}: SmartEmptyStateProps) {
  const filterImpacts = activeFilters
    .map((f) => ({
      filter: f,
      count: allCandidates.filter((c) => candidateMatchesFilter(c, f)).length,
    }))
    .sort((a, b) => a.count - b.count);

  const mostRestrictive = filterImpacts[0];
  const hasSearch = candidateSearch.trim().length > 0;
  const hasFilters = activeFilters.length > 0;
  /**
   * Nothing came back from the server at all, and criteria are set — so the
   * chips and the text box are not the cause and clearing them would do
   * nothing. Saying "no candidates match" and offering only those two is how a
   * recruiter concludes the talent pool is empty when they have in fact asked
   * for twenty years of experience.
   */
  const criteriaAreTheCause = allCandidates.length === 0 && criteriaCount > 0;

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No candidates match</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {criteriaAreTheCause
          ? `Nobody in the talent pool meets ${criteriaCount === 1 ? "that criterion" : "all " + criteriaCount + " criteria"}.`
          : hasSearch && hasFilters
          ? `"${candidateSearch}" + ${activeFilters.length} filter${activeFilters.length > 1 ? "s" : ""} return no results.`
          : hasSearch
          ? `No candidates match "${candidateSearch}".`
          : hasFilters && activeFilters.length === 1
          ? `The "${activeFilters[0]}" filter returns no results in this set.`
          : `The combination of ${activeFilters.length} filters returns no results.`}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2">
        {criteriaCount > 0 && (
          <button
            type="button"
            onClick={onClearCriteria}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Clear refine criteria — searches the whole pool again
          </button>
        )}
        {hasSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Clear search
          </button>
        )}
        {mostRestrictive && mostRestrictive.count > 0 && (
          <button
            type="button"
            onClick={() => onToggleFilter(mostRestrictive.filter)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Remove &ldquo;{mostRestrictive.filter}&rdquo; — restores {mostRestrictive.count} candidate{mostRestrictive.count !== 1 ? "s" : ""}
          </button>
        )}
        {(hasFilters || hasSearch) && (
          <button
            type="button"
            onClick={() => { onClearFilters(); onClearSearch(); }}
            className="text-xs text-accent hover:underline"
          >
            Clear everything
          </button>
        )}
      </div>
    </div>
  );
}

// ─── AI role-profile states ──────────────────────────────────────────────────

/** Wraps AI-generated content so it never renders empty as if it were a real answer. */
function QualState({
  loading,
  failed,
  onRetry,
  children,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your prompt…
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">Couldn't generate this from your prompt.</p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onRetry}>
          <RotateCcw className="h-3 w-3" /> Retry
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: WorkspaceTab; label: string; icon: React.ElementType }[] = [
  { id: "candidates",      label: "Candidates",     icon: Users },
  { id: "pipeline",        label: "Pipeline",        icon: GitBranch },
  { id: "job-description", label: "Job Description", icon: FileText },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkspaceMainProps {
  dockedPrompt: string;
  revealStep: number;
  parsedIntent: ParsedIntent | null;
  onNewSearch: () => void;
}

export function WorkspaceMain({
  dockedPrompt,
  revealStep,
  parsedIntent,
  onNewSearch,
}: WorkspaceMainProps) {
  const roleTitle = promptToRoleTitle(dockedPrompt);

  // ── Persistent shortlist (server-side; survives a refresh) ────────────────
  /**
   * Which project the candidates picked out of this search go into.
   *
   * Null means "this search's own project", which is created on the first add
   * rather than the moment someone searches. Choosing an existing one instead is
   * what stops a third search for the same job starting a third project.
   */
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  const {
    shortlist,
    items: shortlistItems,
    apply: applyShortlist,
  } = useShortlist(dockedPrompt, roleTitle, targetProjectId ?? undefined);

  /**
   * Every project, for the picker — and the others, for moving someone who is
   * already filed in the wrong one. The current project is excluded from the
   * move list: "move to where you already are" is a no-op dressed as a choice.
   */
  const { data: allProjects, others: otherProjects, move: moveToProject } = useProjects(shortlist?.id);

  const [activeTab, setActiveTab]       = useState<WorkspaceTab>("candidates");
  const [activeFilters, setActiveFilters]   = useState<string[]>([]);
  const [outreachTarget, setOutreachTarget] = useState<Candidate | null>(null);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);

  // 6.1 / 6.3 — store sync + outreach tracking
  // The candidates board loads sourced candidates from the server now, so
  // there is nothing to mirror into it from here.

  // 5.3 — candidate text search
  const [candidateSearch, setCandidateSearch] = useState("");

  // 5.6 — edited JD content
  const [editedJDContent, setEditedJDContent] = useState<JobDescriptionContent | null>(null);

  // ── Reset view on a new search (the shortlist itself is keyed per prompt) ──
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setActiveFilters([]);
    setActiveTab("candidates");
    setCandidateSearch("");
    setEditedJDContent(null);
  }, [parsedIntent]);

  // ── Derived data ──────────────────────────────────────────────────────────
  // Real candidates, sourced + AI-ranked from the opt-in talent pool.
  const {
    data: sourced,
    isLoading: sourcing,
    isError: sourcingFailed,
    refetch: retrySourcing,
  } = useSourcedCandidates(parsedIntent?.raw);
  const allCandidates = useMemo(() => sourced?.candidates ?? [], [sourced]);
  /**
   * Everyone the search matches, which is not the list: the list is the top
   * few after AI ranking. Showing the list's length as "Matched" told a
   * recruiter every search's pool was twelve people.
   */
  const pool = sourced?.pool ?? null;

  /**
   * Who has already been written to, from the server.
   *
   * This was a `Set` of names held in component state: it disappeared on
   * refresh, collided between people with the same name, and could not see a
   * colleague's outreach at all — which is the case that matters, since the
   * reason to show it is so nobody approaches the same person twice.
   */
  const contacted = useContactedCandidates(allCandidates.map((c) => c.id));

  /**
   * Whether this seat may move people through the pipeline.
   *
   * The server refuses a stage move from a comment-only seat; the board used
   * to offer it anyway and fail on every drag.
   */
  const { can: canDo } = useMySeat();
  const canMove = canDo("candidates:write");
  const contactedIds = useMemo(
    () => new Set(Object.keys(contacted.data ?? {})),
    [contacted.data],
  );

  // AI-generated role profile: parsed intent, qualifications and the JD — all
  // grounded in the employer's own prompt (replaces the old static templates).
  const {
    data: profile,
    isLoading: profiling,
    isError: profileFailed,
    refetch: retryProfile,
  } = useRoleProfile(parsedIntent?.raw);

  const qualifications = useMemo(
    () => ({ required: profile?.required ?? [], niceToHave: profile?.niceToHave ?? [] }),
    [profile]
  );

  // Prefer the AI's reading of the prompt over the local keyword guess.
  const effectiveIntent = useMemo<ParsedIntent | null>(() => {
    if (!parsedIntent) return null;
    if (!profile) return parsedIntent;
    return {
      ...parsedIntent,
      roleType: profile.roleType as ParsedIntent["roleType"],
      seniority: profile.seniority as ParsedIntent["seniority"],
      keywords: profile.keywords,
      remote: profile.remote,
      location: profile.location,
    };
  }, [parsedIntent, profile]);

  const dynamicFilterGroups = useMemo(() => buildFilterGroups(allCandidates), [allCandidates]);

  const searchCriteria = useSearchCriteria((s) => s.criteria);
  const resetCriteria = useSearchCriteria((s) => s.reset);
  const criteriaCount = activeCriteriaCount(searchCriteria);

  const jobDescContent = profile?.jobDescription ?? null;

  // Active JD: prefer user edits, fall back to generated
  const activeJDContent = editedJDContent ?? jobDescContent;

  // ── Filter chain ──────────────────────────────────────────────────────────
  /**
   * Chips inside one group widen (Toronto OR Vancouver); chips across groups
   * narrow (Toronto AND 8+ yrs).
   *
   * This was one flat some() over every active chip, which made each extra chip
   * return *more* people — so adding "8+ yrs" to a Toronto search brought in
   * juniors from Berlin. A filter that widens is not a filter.
   *
   * Chips no longer offered by any group are ignored rather than AND-ed in:
   * they are not on screen, so a hidden one silently emptying the list is worse
   * than it quietly lapsing.
   */
  const tagFiltered = useMemo(() => {
    if (activeFilters.length === 0) return allCandidates;
    const chosenPerGroup = dynamicFilterGroups
      .map((g) => g.options.filter((o) => activeFilters.includes(o)))
      .filter((chosen) => chosen.length > 0);
    if (chosenPerGroup.length === 0) return allCandidates;
    return allCandidates.filter((c) =>
      chosenPerGroup.every((chosen) => chosen.some((f) => candidateMatchesFilter(c, f))),
    );
  }, [activeFilters, allCandidates, dynamicFilterGroups]);

  const filteredCandidates = !candidateSearch.trim()
    ? tagFiltered
    : tagFiltered.filter((c) => {
        const lower = candidateSearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(lower) ||
          c.role.toLowerCase().includes(lower) ||
          c.company.toLowerCase().includes(lower)
        );
      });

  // ── Shortlist-derived state (server is the source of truth) ───────────────
  const savedCandidates = useMemo(
    () => new Set(shortlistItems.filter((i) => i.saved).map((i) => i.snapshot?.name).filter(Boolean) as string[]),
    [shortlistItems],
  );

  const pipelineCandidates = useMemo<PipelineCandidate[]>(
    () =>
      shortlistItems
        .filter((i) => i.stage && i.snapshot)
        .map((i) => ({
          ...i.snapshot,
          stageId: i.stage as string,
          addedAt: i.addedAt,
          applicationId: i.applicationId,
        })),
    [shortlistItems],
  );

  /** The cards/board key by name; the shortlist keys by candidate id. */
  const idForName = useCallback(
    (name: string): string | undefined =>
      allCandidates.find((c) => c.name === name)?.id ??
      shortlistItems.find((i) => i.snapshot?.name === name)?.candidateId,
    [allCandidates, shortlistItems],
  );

  const snapshotForName = useCallback(
    (name: string): Candidate | undefined =>
      allCandidates.find((c) => c.name === name) ??
      shortlistItems.find((i) => i.snapshot?.name === name)?.snapshot,
    [allCandidates, shortlistItems],
  );

  // ── Pipeline actions (persisted) ─────────────────────────────────────────
  const toggleSaved = (name: string) => {
    const id = idForName(name);
    if (!id) return toast.error("This candidate can't be saved yet.");
    applyShortlist({ candidateId: id, saved: !savedCandidates.has(name), snapshot: snapshotForName(name) });
  };

  const addToPipeline = (candidate: Candidate) => {
    if (!candidate.id) return toast.error("This candidate can't be added yet.");
    // Persisted to the shortlist, which is what the candidates board reads.
    // There used to be a second, session-local copy pushed into that board; it
    // vanished on refresh and invented per-skill match scores.
    applyShortlist({ candidateId: candidate.id, stage: "SOURCED", snapshot: candidate });
  };

  const movePipelineStage = (name: string, stageId: string) => {
    const id = idForName(name);
    if (!id) return;
    // One write. Both boards read the same row, so there is no second copy to
    // keep in step.
    applyShortlist({ candidateId: id, stage: stageId as ShortlistStage, snapshot: snapshotForName(name) });
  };

  /** Leaves the pipeline; the server keeps it only if it's still saved. */
  const removeFromPipeline = (name: string) => {
    const id = idForName(name);
    if (!id) return;
    applyShortlist({ candidateId: id, stage: null });
  };

  const toggleFilter = (value: string) =>
    setActiveFilters((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );

  const interviewing = pipelineCandidates.filter((c) => c.stageId === "INTERVIEW").length;

  // ─────────────────────────────────────────────────────────────────────────

  // pb-24 keeps the last card clear of the copilot's floating button, which
  // only exists below lg.
  return (
    <div className="px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* ── 5.1 Workspace top bar: current prompt + New Search ── */}
        {revealStep >= REVEAL.ROLE_SUMMARY && (
          <div className="flex items-center justify-between gap-4 animate-fade-in">
            <p
              className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              title={dockedPrompt}
            >
              {dockedPrompt}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onNewSearch}
            >
              <RotateCcw className="h-3 w-3" />
              New Search
            </Button>
          </div>
        )}

        {/* ── 5.4 Generating phase: step list ── */}
        {revealStep === 0 && <GeneratingIndicator sourcing={sourcing} failed={sourcingFailed} />}

        {/* Indeterminate bar while the real sourcing request is in flight — a
            percentage here would be invented, since we can't know its progress. */}
        {revealStep > 0 && sourcing && (
          <div className="h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        )}

        {/* ── Tab bar ── */}
        {revealStep >= REVEAL.ROLE_SUMMARY && (
          <div className="animate-fade-in">
            <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === "pipeline" && pipelineCandidates.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {pipelineCandidates.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ CANDIDATES TAB ══ */}
        {activeTab === "candidates" && (
          <div className="space-y-6">
            <Section title="Role Summary" revealed={revealStep >= REVEAL.ROLE_SUMMARY}>
              <RoleSummary intent={effectiveIntent} />
            </Section>

            <Section title="Required Qualifications" revealed={revealStep >= REVEAL.REQUIRED_QUALS}>
              <QualState loading={profiling} failed={profileFailed} onRetry={() => retryProfile()}>
                <QualList items={qualifications.required} variant="required" />
              </QualState>
            </Section>

            <Section title="Nice to Have" revealed={revealStep >= REVEAL.NICE_TO_HAVE}>
              <QualState loading={profiling} failed={profileFailed} onRetry={() => retryProfile()}>
                <QualList items={qualifications.niceToHave} variant="nice" />
              </QualState>
            </Section>

            <Section
              title="Matched Candidates"
              subtitle={
                // Only claim a count once the real request has actually returned.
                revealStep >= REVEAL.CANDIDATES && !sourcing && !sourcingFailed
                  ? pool && pool.total > allCandidates.length
                    ? `${
                        filteredCandidates.length === allCandidates.length
                          ? `Top ${allCandidates.length}`
                          : `${filteredCandidates.length} of top ${allCandidates.length}`
                      } · ${formatPool(pool)} match · sorted by AI match`
                    : `${filteredCandidates.length} of ${allCandidates.length} candidates · sorted by AI match`
                  : undefined
              }
              // No artificial gate: the section carries real loading/error states,
              // so results appear the moment sourcing actually returns.
              revealed={revealStep >= REVEAL.ROLE_SUMMARY}
            >
              {/* 5.3 — Candidate search input */}
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search by name, role, or company…"
                  className="h-8 rounded-xl pl-8 pr-8 text-xs"
                />
                {candidateSearch && (
                  <button
                    type="button"
                    onClick={() => setCandidateSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Server-side criteria sit above the chips, because they decide
                  which candidates exist here at all; the chips only narrow what
                  came back. */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <RefineSearchPanel />
                {/* Stated once, where the candidates it applies to are, so
                    nobody has to guess where "Add to pipeline" puts people. */}
                <ProjectPicker
                  projects={allProjects ?? []}
                  activeId={targetProjectId}
                  activeLabel={
                    shortlist
                      ? projectLabel(shortlist)
                      : targetProjectId
                      ? "Loading…"
                      : roleTitle || "This search"
                  }
                  onPick={setTargetProjectId}
                />
              </div>

              <FiltersBar
                filterGroups={dynamicFilterGroups}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onClearAll={() => setActiveFilters([])}
              />

              <PipelineStats
                totalMatched={pool ? formatPool(pool) : allCandidates.length}
                saved={savedCandidates.size}
                inPipeline={pipelineCandidates.length}
                interviewing={interviewing}
              />

              <div className="grid gap-3">
                {filteredCandidates.map((c, i) => (
                  <CandidateCard
                    key={c.name}
                    {...c}
                    delay={i * 80}
                    saved={savedCandidates.has(c.name)}
                    pipelineStageId={
                      pipelineCandidates.find((p) => p.name === c.name)?.stageId
                    }
                    outreached={contacted.contacted(c.id)}
                    onSave={() => toggleSaved(c.name)}
                    onAddToPipeline={() => addToPipeline(c)}
                    onGenerateOutreach={() => setOutreachTarget(c)}
                    onViewProfile={() => setViewingCandidate(c)}
                  />
                ))}

                {/* Real request state — skeletons only while sourcing is actually running. */}
                {sourcing && <CandidateSkeleton />}

                {/* A failed request is an error, not "no matches". */}
                {sourcingFailed && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
                    <p className="text-sm font-medium text-foreground">Couldn't source candidates</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The search didn't complete. This is a connection problem, not an empty result.
                    </p>
                    <Button size="sm" variant="outline" className="mt-4 h-8 gap-1.5 text-xs" onClick={() => retrySourcing()}>
                      <RotateCcw className="h-3 w-3" /> Retry
                    </Button>
                  </div>
                )}

                {/* 5.5 — Smart empty state (only once we truly know the result is empty) */}
                {filteredCandidates.length === 0 && !sourcing && !sourcingFailed && (
                  <SmartEmptyState
                    activeFilters={activeFilters}
                    candidateSearch={candidateSearch}
                    allCandidates={allCandidates}
                    criteriaCount={criteriaCount}
                    onToggleFilter={toggleFilter}
                    onClearFilters={() => setActiveFilters([])}
                    onClearSearch={() => setCandidateSearch("")}
                    onClearCriteria={resetCriteria}
                  />
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ══ PIPELINE TAB ══ */}
        {activeTab === "pipeline" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Hiring Pipeline</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pipelineCandidates.length} candidate
                  {pipelineCandidates.length !== 1 ? "s" : ""} across{" "}
                  {pipelineStages.length} stages · drag cards between columns to move
                </p>
              </div>
              {pipelineCandidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1.5 text-xs"
                  onClick={() => exportPipelineCSV(pipelineCandidates, pipelineStages)}
                >
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
              )}
            </div>

            <PipelineBoard
              stages={pipelineStages}
              candidates={pipelineCandidates}
              onMoveStage={movePipelineStage}
              onOpenOutreach={setOutreachTarget}
              onRemoveFromPipeline={removeFromPipeline}
              canMove={canMove}
              projects={otherProjects}
              onMoveToProject={(name, projectId) => {
                const itemId = shortlistItems.find(
                  (i) => i.candidateId === idForName(name),
                )?.id;
                if (!itemId) return toast.error("That candidate can't be moved yet.");
                moveToProject(itemId, projectId);
              }}
              contactedIds={contactedIds}
            />
          </div>
        )}

        {/* ══ JOB DESCRIPTION TAB ══ */}
        {activeTab === "job-description" && (
          <QualState loading={profiling} failed={profileFailed} onRetry={() => retryProfile()}>
            {activeJDContent && (
              <JobDescription
                roleTitle={profile?.roleTitle || roleTitle}
                content={activeJDContent}
                onContentChange={setEditedJDContent}
              />
            )}
          </QualState>
        )}

        <div className="h-12" />
      </div>

      {/* Outreach dialog */}
      <OutreachDialog
        candidate={outreachTarget}
        role={parsedIntent?.raw}
        // What `{{job_title}}` means for someone who never applied: the name the
        // team gave this project, else the role it is for.
        roleTitle={shortlist?.name?.trim() || shortlist?.roleTitle?.trim() || profile?.roleTitle || roleTitle}
        onClose={() => setOutreachTarget(null)}
        // Refetch rather than guess locally: the server is what knows, and it
        // also knows about whatever a colleague sent a minute ago.
        onSent={() => void contacted.refetch()}
      />

      {/* Candidate profile sheet */}
      <CandidateProfileSheet
        candidate={viewingCandidate}
        inPipeline={Boolean(pipelineCandidates.find((p) => p.name === viewingCandidate?.name))}
        // Matched on candidate id, not name: this decides whether the notes
        // panel is offered, and the server refuses anyone who is not really on
        // a shortlist. Two people called J. Smith must not unlock each other.
        onShortlist={Boolean(
          viewingCandidate?.id &&
            shortlistItems.some((i) => i.candidateId === viewingCandidate.id),
        )}
        onClose={() => setViewingCandidate(null)}
        onAddToPipeline={() => { if (viewingCandidate) addToPipeline(viewingCandidate); }}
        onGenerateOutreach={() => {
          if (viewingCandidate) {
            setOutreachTarget(viewingCandidate);
            setViewingCandidate(null);
          }
        }}
      />
    </div>
  );
}
