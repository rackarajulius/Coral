import { Sparkles, Bookmark, BookmarkCheck, Plus, Mail, GraduationCap, Clock, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/data/employer/HiringAssistant/Index";

interface CandidateCardProps extends Candidate {
  delay?: number;
  saved?: boolean;
  pipelineStageId?: string;
  outreached?: boolean;
  onSave?: () => void;
  onAddToPipeline?: () => void;
  onGenerateOutreach?: () => void;
  onViewProfile?: () => void;
}

const CONNECTION_STYLE: Record<string, string> = {
  "1st":  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "2nd":  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "3rd+": "bg-muted text-muted-foreground",
};

export function CandidateCard({
  name,
  role,
  company,
  location,
  match,
  reason,
  initials,
  skills,
  yearsExp,
  education,
  connection,
  openToWork,
  lastActive,
  delay = 0,
  saved = false,
  pipelineStageId,
  outreached = false,
  onSave,
  onAddToPipeline,
  onGenerateOutreach,
  onViewProfile,
}: CandidateCardProps) {
  const inPipeline = Boolean(pipelineStageId);

  return (
    <div
      className="group rounded-2xl border border-border bg-card p-4 shadow-card
                 animate-fade-in transition-all
                 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-elevated"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl
                       bg-gradient-to-br from-primary to-primary/70
                       text-sm font-semibold text-primary-foreground"
          >
            {initials}
          </div>
          {openToWork && (
            <span
              title="Open to work"
              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    CONNECTION_STYLE[connection]
                  )}
                >
                  {connection}
                </span>
                {openToWork && (
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Open to Work
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {role} · {company}
              </p>
              <p className="truncate text-xs text-muted-foreground">{location}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {/* 5.2 — Match score badge with breakdown tooltip */}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex cursor-default items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-xs font-semibold text-accent"
                      aria-label={`${match}% AI match`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {match}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="w-56 p-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      AI match score
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      How well this profile fits the role, judged on skills, experience and
                      seniority. See the AI's reasoning below.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                type="button"
                onClick={onSave}
                aria-label={saved ? "Unsave candidate" : "Save candidate"}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {saved ? (
                  <BookmarkCheck className="h-4 w-4 text-accent" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3 shrink-0" />
              {education}
            </span>
            <span>{yearsExp}y exp</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              Active {lastActive}
            </span>
          </div>

          {/* Skills */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="rounded-md border border-border/60 bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
              >
                {skill}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="rounded-md px-1 py-0.5 text-[11px] text-muted-foreground">
                +{skills.length - 4}
              </span>
            )}
          </div>

          {/* AI reasoning */}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/70">AI reasoning · </span>
            {reason}
          </p>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 rounded-lg gap-1 text-xs",
                outreached && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              )}
              onClick={onGenerateOutreach}
            >
              {outreached ? (
                <><CheckCircle2 className="h-3 w-3" />Resend</>
              ) : (
                <><Mail className="h-3 w-3" />Reach out</>
              )}
            </Button>
            <Button
              size="sm"
              variant={inPipeline ? "secondary" : "outline"}
              className={cn("h-7 rounded-lg gap-1 text-xs", inPipeline && "text-accent")}
              onClick={!inPipeline ? onAddToPipeline : undefined}
              disabled={inPipeline}
            >
              {inPipeline ? (
                <><Check className="h-3 w-3" />In Pipeline</>
              ) : (
                <><Plus className="h-3 w-3" />Add to Pipeline</>
              )}
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
              onClick={onViewProfile}
            >
              View Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CandidateSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 shrink-0 rounded-xl shimmer" />
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-1/3 rounded shimmer" />
          <div className="h-3 w-2/3 rounded shimmer" />
          <div className="mt-1 flex gap-2">
            <div className="h-5 w-16 rounded-md shimmer" />
            <div className="h-5 w-16 rounded-md shimmer" />
            <div className="h-5 w-16 rounded-md shimmer" />
          </div>
          <div className="mt-2 flex gap-2">
            <div className="h-7 w-16 rounded-lg shimmer" />
            <div className="h-7 w-24 rounded-lg shimmer" />
            <div className="h-7 w-20 rounded-lg shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
