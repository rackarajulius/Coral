import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import {
  generateCoverLetter,
  tailorResume,
  type MatchedJob,
  type ResumeTailoring,
} from "@/lib/api/resumeMatcher";
import { upgradeOnRefusal } from "@/lib/resumeMatcher/upgradeOnRefusal";
import { BulletSection, Centered } from "./shared";

export type AssistRequest = { job: MatchedJob; mode: "cover" | "tailor" };

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Couldn't copy"),
  );
}

/** The server takes up to 8,000 characters of description (AssistDto); matches now carry the whole ad. */
const ASSIST_DESCRIPTION_MAX = 8000;

function jobContext(job: MatchedJob) {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description?.slice(0, ASSIST_DESCRIPTION_MAX),
  };
}

export function AssistDialog({ assist, onClose }: { assist: AssistRequest | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const handlers = {
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
    onError: (error: Error) => upgradeOnRefusal(error, onClose, showUpgrade),
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

function TailoringView({ data }: { data: ResumeTailoring }) {
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
      {data.suggestions.length > 0 && <BulletSection title="Suggested edits" items={data.suggestions} />}
    </div>
  );
}
