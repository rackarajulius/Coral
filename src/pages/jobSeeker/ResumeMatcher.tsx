import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyEntitlements, refusalFor, type SeekerMetric } from "@/lib/api/entitlements";
import { isEntitlementError } from "@/lib/api/entitlementError";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { createExternalApplication } from "@/lib/api/externalApplications";
import {
  Sparkles,
  Lock,
  Loader2,
  Wand2,
  FileText,
  Copy,
  Building2,
  ExternalLink,
  Search,
  MapPin,
  Wallet,
  UserPlus,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  runResumeMatch,
  generateCoverLetter,
  tailorResume,
  researchCompany,
  type MatchedJob,
} from "@/lib/api/resumeMatcher";

const ResumeMatcher = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);

  /**
   * Runs for everyone. This page used to be a wall for anyone without
   * Premium, which would have denied free users the platform matching their
   * tier includes. The server decides which sources to search and says so.
   */
  const { data: result, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["resume-matcher", "run", user?.id ?? "", activeQuery ?? ""],
    queryFn: async ({ signal }) => {
      const data = await runResumeMatch(activeQuery, signal);
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      return data;
    },
    enabled: isAuthenticated && !isAuthLoading,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === user?.id ? previousData : undefined,
    // Each completed web search can consume allowance; retry explicitly.
    retry: false,
    refetchOnReconnect: false,
  });
  const hasHeuristicScores = result?.matches.some((match) => match.scoringMode === "heuristic");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading || isFetching) return;
    if (!isAuthenticated) {
      openAuth({ redirectTo: "/resume-matcher" });
      return;
    }
    const nextQuery = searchInput.trim() || undefined;
    if (nextQuery === activeQuery) {
      void refetch({ cancelRefetch: false });
      return;
    }
    // An explicit search refreshes even a recently visited query.
    void queryClient.invalidateQueries({
      queryKey: ["resume-matcher", "run", user?.id ?? "", nextQuery ?? ""],
      exact: true,
      refetchType: "none",
    });
    setActiveQuery(nextQuery);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6 pt-24">
        {/* Title */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral/10 text-coral px-3 py-1 text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" /> {hasHeuristicScores ? "Keyword matcher" : "AI matcher"}
          </div>
          <h1 className="text-2xl font-bold text-foreground">Jobs matched to your resume</h1>
          <p className="text-muted-foreground mt-1">
            Roles ranked against your profile — jobs posted here, and from across the web with
            Premium. Search a specific role, or let us match you.
          </p>
        </div>

          <>
            {/* Search bar */}
            <form onSubmit={submitSearch} className="flex items-center gap-2 mb-6">
              <div className="flex flex-1 items-center h-11 rounded-full bg-card border border-border px-4 gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search a role, e.g. “Product Designer” — or leave blank to match your resume"
                  className="border-0 bg-transparent px-0 h-auto shadow-none focus-visible:ring-0"
                />
              </div>
              <Button type="submit" variant="coral" className="rounded-full px-6" disabled={isFetching || isAuthLoading}>
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>

            {isAuthLoading ? (
              <Centered><Loader2 className="h-4 w-4 animate-spin" /> Loading…</Centered>
            ) : !isAuthenticated ? (
              <Centered>
                Sign in to match jobs to your profile.
                <Button variant="coral" onClick={() => openAuth({ redirectTo: "/resume-matcher" })}>Sign in</Button>
              </Centered>
            ) : isError ? (
              <Centered>
                <span className="text-destructive">{(error as Error)?.message || "Something went wrong."}</span>
                <Button variant="outline" disabled={isFetching} onClick={() => void refetch({ cancelRefetch: false })}>
                  {isFetching ? "Retrying…" : "Retry"}
                </Button>
              </Centered>
            ) : result && !result.hasProfile ? (
              <NoProfile />
            ) : isFetching && !result ? (
              <Centered>
                <Loader2 className="h-4 w-4 animate-spin" /> Finding matches…
              </Centered>
            ) : result ? (
              <>
                {result.scope === "platform" && result.webBlockedReason && (
                  <WebScopeNotice reason={result.webBlockedReason} />
                )}
                {hasHeuristicScores && (
                  <p role="status" className="mb-5 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    AI scoring is temporarily unavailable. Results labeled “Keyword match” use overlap with your saved skills.
                  </p>
                )}
                <MatchList matches={result.matches} loading={isFetching} />
              </>
            ) : (
              <Centered>Search again to refresh your matches.</Centered>
            )}
          </>
      </main>
    </div>
  );
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">{children}</div>
  );
}

/* ------------------------------- Upsell -------------------------------- */

/**
 * Says why these are only platform jobs.
 *
 * Shown above the results rather than instead of them: free users still get
 * real matches, and the link goes to the Premium page.
 */
function WebScopeNotice({ reason }: { reason: "PREMIUM_REQUIRED" | "ALLOWANCE_EXHAUSTED" }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="h-9 w-9 shrink-0 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
        <Lock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Showing jobs posted on this platform</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {reason === "ALLOWANCE_EXHAUSTED"
            ? "You've used today's web searches. Jobs from across the web come back tomorrow."
            : "Matches from across the web — plus cover letters and resume tailoring — are part of Premium."}{" "}
          <Link to="/premium" className="font-medium text-coral hover:underline">
            See Premium
          </Link>
        </p>
      </div>
    </div>
  );
}

function NoProfile() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-xl mx-auto">
      <div className="h-14 w-14 rounded-2xl bg-coral/10 text-coral flex items-center justify-center mx-auto mb-4">
        <UserPlus className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Complete your profile first</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        We match jobs against your resume. Add your skills and experience to your profile, then come back.
      </p>
      <Button variant="coral" className="mt-6" asChild>
        <Link to="/jobseeker/profile">Go to my profile</Link>
      </Button>
    </div>
  );
}

/* ------------------------------- Matches ------------------------------- */

function MatchList({ matches, loading }: { matches: MatchedJob[]; loading: boolean }) {
  const [assist, setAssist] = useState<{ job: MatchedJob; mode: "cover" | "tailor" } | null>(null);
  const [research, setResearch] = useState<MatchedJob | null>(null);
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    staleTime: 60_000,
    retry: false,
  });

  /**
   * Opens a paid tool only when the plan covers it right now, and otherwise
   * explains why — before any request is made. The server still refuses on
   * its own; this is just so the answer comes before the loading spinner.
   */
  const gated = (metric: SeekerMetric, open: () => void) => () => {
    const refusal = refusalFor(entitlements, metric);
    if (refusal) showUpgrade(refusal);
    else open();
  };
  const locked = (metric: SeekerMetric) => refusalFor(entitlements, metric) !== null;

  if (matches.length === 0) {
    return (
      <Centered>
        No matches yet. Try a different role, or add more detail to your profile.
      </Centered>
    );
  }

  return (
    <>
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            m={m}
            onCover={gated("assist.cover_letter", () => setAssist({ job: m, mode: "cover" }))}
            onTailor={gated("assist.tailor", () => setAssist({ job: m, mode: "tailor" }))}
            onResearch={gated("research.company", () => setResearch(m))}
            locked={{
              cover: locked("assist.cover_letter"),
              tailor: locked("assist.tailor"),
              research: locked("research.company"),
            }}
          />
        ))}
      </div>

      <AssistDialog assist={assist} onClose={() => setAssist(null)} />
      <ResearchDialog job={research} onClose={() => setResearch(null)} />
    </>
  );
}

function MatchCard({
  m,
  onCover,
  onTailor,
  onResearch,
  locked,
}: {
  m: MatchedJob;
  onCover: () => void;
  onTailor: () => void;
  onResearch: () => void;
  /** Which tools the plan doesn't cover right now; shown with a lock. */
  locked?: { cover: boolean; tailor: boolean; research: boolean };
}) {
  const queryClient = useQueryClient();
  const trackExternal = () => {
    if (m.source === "platform" || !m.url) return;
    void createExternalApplication({
      sourceKey: `match:${m.id}`,
      title: m.title,
      company: m.company,
      url: m.url,
    }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["external-applications"] });
      toast.success("Saved to External tracker. Mark applied after you submit.");
    }).catch((error: Error) => toast.error(error.message));
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
          {m.company.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
              <p className="text-sm text-muted-foreground truncate">{m.company}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-bold text-coral" aria-label={`${m.scoringMode === "heuristic" ? "Keyword match" : "Match"} score: ${m.matchScore}%`}>
                {m.matchScore}%
              </span>
              {m.scoringMode === "heuristic" && <span className="text-[10px] text-muted-foreground">Keyword match</span>}
              <SourceBadge source={m.source} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {m.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {m.location}
              </span>
            )}
            {m.salary && (
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" /> {m.salary}
              </span>
            )}
          </div>
          {m.reason && <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{m.reason}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border">
        <Button size="sm" variant="outline" className="h-8" onClick={onCover}>
          {locked?.cover ? <Lock className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} Cover letter
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onTailor}>
          {locked?.tailor ? <Lock className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />} Tailor
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onResearch}>
          {locked?.research ? <Lock className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />} Research
        </Button>
        {m.url && (
          <a
            href={m.url}
            onClick={trackExternal}
            target={m.url.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="ml-auto text-sm font-medium text-foreground hover:text-coral transition-colors"
          >
            {m.source === "platform" ? "View job →" : "Open & track →"}
          </a>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Source badge ---------------------------- */

const SOURCE_LABELS: Record<string, string> = {
  platform: "Our platform",
  adzuna: "Adzuna",
  jsearch: "Web",
  talent: "Talent.com",
  greenhouse: "Employer",
  lever: "Employer",
};

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? "Web";
  const isPlatform = source === "platform";
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
        isPlatform ? "bg-coral/10 text-coral" : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/* ------------------------------ Assist dialog -------------------------- */

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Couldn't copy"),
  );
}

function jobContext(job: MatchedJob) {
  return { title: job.title, company: job.company, location: job.location, description: job.description };
}

function AssistDialog({
  assist,
  onClose,
}: {
  assist: { job: MatchedJob; mode: "cover" | "tailor" } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  // The limit can be reached between loading the page and pressing the button;
  // a refusal then closes this dialog and explains, rather than showing an error.
  const handlers = {
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
    onError: (error: Error) => {
      if (isEntitlementError(error)) {
        onClose();
        showUpgrade({ code: error.code, metric: error.metric, tier: error.tier, resetsAt: error.resetsAt, message: error.message });
      }
    },
  };
  const coverMut = useMutation({ mutationFn: (job: MatchedJob) => generateCoverLetter(jobContext(job)), ...handlers });
  const tailorMut = useMutation({ mutationFn: (job: MatchedJob) => tailorResume(jobContext(job)), ...handlers });

  const key = assist ? `${assist.mode}:${assist.job.id}` : "";
  const [ranKey, setRanKey] = useState("");
  if (assist && key !== ranKey) {
    setRanKey(key);
    coverMut.reset();
    tailorMut.reset();
    (assist.mode === "cover" ? coverMut : tailorMut).mutate(assist.job);
  }

  const isCover = assist?.mode === "cover";
  const mut = isCover ? coverMut : tailorMut;

  return (
    <Dialog open={!!assist} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCover ? "Cover letter" : "Tailor your resume"}</DialogTitle>
          <DialogDescription>
            {assist?.job.title} · {assist?.job.company}
          </DialogDescription>
        </DialogHeader>

        {mut.isPending ? (
          <Centered>
            <Loader2 className="h-4 w-4 animate-spin" /> {isCover ? "Drafting…" : "Tailoring…"}
          </Centered>
        ) : mut.isError ? (
          <p className="text-sm text-destructive py-8 text-center">
            {(mut.error as Error)?.message || "Something went wrong."}
          </p>
        ) : isCover && coverMut.data ? (
          <div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {coverMut.data.coverLetter}
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => copyText(coverMut.data!.coverLetter)}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>
        ) : !isCover && tailorMut.data ? (
          <TailoringView data={tailorMut.data} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TailoringView({ data }: { data: import("@/lib/api/resumeMatcher").ResumeTailoring }) {
  return (
    <div className="space-y-5">
      {data.tailoredSummary && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-foreground">Rewritten summary</p>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyText(data.tailoredSummary)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed rounded-xl border border-border bg-muted/30 p-3">
            {data.tailoredSummary}
          </p>
        </section>
      )}
      {data.emphasizedSkills.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">Emphasize these skills</p>
          <div className="flex flex-wrap gap-1.5">
            {data.emphasizedSkills.map((s) => (
              <span key={s} className="px-2.5 py-0.5 rounded-full bg-coral/10 text-coral text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
      {data.keywordsToAdd.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">Keywords to add (if true to your experience)</p>
          <div className="flex flex-wrap gap-1.5">
            {data.keywordsToAdd.map((s) => (
              <span key={s} className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
      {data.suggestions.length > 0 && <Section title="Suggested edits" items={data.suggestions} />}
    </div>
  );
}

/* ---------------------------- Research dialog -------------------------- */

function ResearchDialog({ job, onClose }: { job: MatchedJob | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const mut = useMutation({
    mutationFn: (j: MatchedJob) => researchCompany(j.company, j.title),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
    onError: (error: Error) => {
      if (isEntitlementError(error)) {
        onClose();
        showUpgrade({ code: error.code, metric: error.metric, tier: error.tier, resetsAt: error.resetsAt, message: error.message });
      }
    },
  });

  const key = job ? job.id : "";
  const [ranKey, setRanKey] = useState("");
  if (job && key !== ranKey) {
    setRanKey(key);
    mut.reset();
    mut.mutate(job);
  }

  const data = mut.data;

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-coral" /> {job?.company}
          </DialogTitle>
          <DialogDescription>Researched live from the web — verify anything important.</DialogDescription>
        </DialogHeader>

        {mut.isPending ? (
          <Centered>
            <Loader2 className="h-4 w-4 animate-spin" /> Researching the web…
          </Centered>
        ) : mut.isError ? (
          <p className="text-sm text-destructive py-8 text-center">
            {(mut.error as Error)?.message || "Something went wrong."}
          </p>
        ) : data && !data.configured ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Company research isn't set up in this environment yet (needs a Firecrawl key).
          </p>
        ) : data && !data.profile ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            We couldn't find enough public information about this company.
          </p>
        ) : data?.profile ? (
          <CompanyProfileView profile={data.profile} sources={data.sources} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompanyProfileView({
  profile,
  sources,
}: {
  profile: NonNullable<import("@/lib/api/resumeMatcher").CompanyResearchResult["profile"]>;
  sources: { title: string; url: string }[];
}) {
  const meta = [
    profile.industry && `Industry: ${profile.industry}`,
    profile.size && `Size: ${profile.size}`,
    profile.headquarters && `HQ: ${profile.headquarters}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      {profile.summary && <p className="text-sm text-foreground leading-relaxed">{profile.summary}</p>}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {meta.map((m) => (
            <span key={m} className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">
              {m}
            </span>
          ))}
        </div>
      )}
      {profile.highlights.length > 0 && <Section title="Highlights" items={profile.highlights} />}
      {profile.culture.length > 0 && <Section title="Culture & reputation" items={profile.culture} />}
      {profile.interviewQuestions.length > 0 && (
        <Section title="Questions to ask them" items={profile.interviewQuestions} />
      )}
      {sources.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">Sources</p>
          <ul className="space-y-1">
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-coral transition-colors truncate max-w-full"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.title || s.url}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-coral">•</span>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ResumeMatcher;
