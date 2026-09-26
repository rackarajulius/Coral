import { useState } from "react";
import { Building2, ChevronDown, ExternalLink, Loader2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCompanyResearch, type CompanyResearch } from "@/lib/api/jobs";

/**
 * "What's it actually like there" — summarised from real web sources, with the
 * sources cited so the candidate can check them.
 *
 * Loaded on demand rather than on mount: it's a live crawl + LLM call, so it
 * only runs when someone actually asks for it.
 */
export default function CompanyResearchPanel({
  jobId,
  company,
  variant = "card",
}: {
  jobId: string;
  company: string;
  /** "inline" drops the outer card + heading when nested in another section. */
  variant?: "card" | "inline";
}) {
  const [data, setData] = useState<CompanyResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  const load = async () => {
    setLoading(true);
    setAsked(true);
    try {
      setData(await getCompanyResearch(jobId));
    } finally {
      setLoading(false);
    }
  };

  const profile = data?.profile;
  const facts = [
    profile?.industry && { label: "Industry", value: profile.industry },
    profile?.size && { label: "Size", value: profile.size },
    profile?.headquarters && { label: "HQ", value: profile.headquarters },
  ].filter(Boolean) as { label: string; value: string }[];

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    variant === "inline" ? (
      <div>{children}</div>
    ) : (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-coral" /> About {company}
        </h2>
        {children}
      </section>
    );

  return (
    <Wrapper>

      {!asked ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Get a quick read on what this company does, its culture, and what they tend to ask in
            interviews — summarised from public sources.
          </p>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Research this company
          </Button>
        </>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading public sources…
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">
          Couldn't load company research just now.{" "}
          <button onClick={load} className="text-coral hover:underline">
            Try again
          </button>
        </p>
      ) : !data.configured ? (
        <p className="text-sm text-muted-foreground">
          Company research isn't set up on this environment yet.
        </p>
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">
          We couldn't find enough public information about {company} to summarise.
        </p>
      ) : (
        <div className="space-y-4">
          {profile.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">{profile.summary}</p>
          )}

          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {facts.map((f) => (
                <span key={f.label} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{f.label}:</span> {f.value}
                </span>
              ))}
            </div>
          )}

          {profile.culture.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Culture signals
              </p>
              <ul className="space-y-1">
                {profile.culture.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.highlights.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent highlights
              </p>
              <ul className="space-y-1">
                {profile.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.interviewQuestions.length > 0 && (
            <Collapsible label={`Likely interview questions (${profile.interviewQuestions.length})`}>
              <ul className="mt-2 space-y-1.5">
                {profile.interviewQuestions.map((q) => (
                  <li key={q} className="flex gap-2 text-sm text-muted-foreground">
                    <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
                    {q}
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {/* Citations — so nothing here has to be taken on faith. */}
          {data.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sources
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {data.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-coral hover:underline"
                  >
                    {s.title || new URL(s.url).hostname}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && children}
    </div>
  );
}
