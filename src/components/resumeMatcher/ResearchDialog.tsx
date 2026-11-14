import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import { researchCompany, type CompanyResearchResult, type MatchedJob } from "@/lib/api/resumeMatcher";
import { upgradeOnRefusal } from "@/lib/resumeMatcher/upgradeOnRefusal";
import { BulletSection, Centered } from "./shared";

export function ResearchDialog({ job, onClose }: { job: MatchedJob | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const mut = useMutation({
    mutationFn: (j: MatchedJob) => researchCompany(j.company, j.title),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
    onError: (error: Error) => upgradeOnRefusal(error, onClose, showUpgrade),
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
  profile: NonNullable<CompanyResearchResult["profile"]>;
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
      {profile.highlights.length > 0 && <BulletSection title="Highlights" items={profile.highlights} />}
      {profile.culture.length > 0 && <BulletSection title="Culture & reputation" items={profile.culture} />}
      {profile.interviewQuestions.length > 0 && (
        <BulletSection title="Questions to ask them" items={profile.interviewQuestions} />
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
