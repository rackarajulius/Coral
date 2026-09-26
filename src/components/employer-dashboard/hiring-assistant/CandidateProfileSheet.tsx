import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  MapPin,
  GraduationCap,
  Clock,
  Mail,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CandidateNotesPanel } from "@/components/employer-dashboard/candidates/CandidateNotesPanel";
import type { Candidate } from "@/data/employer/HiringAssistant/Index";

/** For "Save Priya first" rather than "Save Priya Raghunathan first". */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const CONNECTION_STYLE: Record<string, string> = {
  "1st":  "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20",
  "2nd":  "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20",
  "3rd+": "bg-muted text-muted-foreground ring-1 ring-border",
};

const matchTone = (score: number) =>
  score >= 90
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
    : score >= 80
    ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
    : "text-amber-600 dark:text-amber-400 bg-amber-500/10";

interface CandidateProfileSheetProps {
  candidate: Candidate | null;
  inPipeline?: boolean;
  /**
   * Whether this person is on a shortlist yet.
   *
   * The server only accepts notes about someone who applied or was shortlisted,
   * so a company cannot accumulate a file on people who never engaged with it.
   * The panel below follows that rule rather than discovering it as an error.
   */
  onShortlist?: boolean;
  onClose: () => void;
  onAddToPipeline?: () => void;
  onGenerateOutreach?: () => void;
}

export function CandidateProfileSheet({
  candidate,
  inPipeline = false,
  onShortlist = false,
  onClose,
  onAddToPipeline,
  onGenerateOutreach,
}: CandidateProfileSheetProps) {
  return (
    <Sheet open={Boolean(candidate)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetTitle className="sr-only">
          {candidate?.name ?? "Candidate profile"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          AI-matched candidate profile
        </SheetDescription>

        {candidate && <ProfileBody
          candidate={candidate}
          inPipeline={inPipeline}
          onShortlist={onShortlist}
          onAddToPipeline={onAddToPipeline}
          onGenerateOutreach={onGenerateOutreach}
        />}
      </SheetContent>
    </Sheet>
  );
}

function ProfileBody({
  candidate: c,
  inPipeline,
  onShortlist,
  onAddToPipeline,
  onGenerateOutreach,
}: {
  candidate: Candidate;
  inPipeline: boolean;
  onShortlist: boolean;
  onAddToPipeline?: () => void;
  onGenerateOutreach?: () => void;
}) {
  return (
    <ScrollArea className="flex-1">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-br from-accent/5 via-background to-background px-6 pt-8 pb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl
                         bg-gradient-to-br from-primary to-primary/70
                         text-base font-semibold text-primary-foreground shadow-sm"
            >
              {c.initials}
            </div>
            {c.openToWork && (
              <span
                title="Open to work"
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-500"
              />
            )}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{c.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  CONNECTION_STYLE[c.connection]
                )}
              >
                {c.connection}
              </span>
              {c.openToWork && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Open to Work
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {c.role} · {c.company}
            </p>

            {/* Match score */}
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ring-current/20"
              style={{ /* dynamic via tailwind classes below */ }}
            >
              <div className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold", matchTone(c.match))}>
                <Sparkles className="h-3.5 w-3.5" />
                {c.match}% match
                <span className="ml-1 text-xs font-normal opacity-70">
                  {c.match >= 90 ? "Excellent fit" : c.match >= 80 ? "Strong fit" : "Possible fit"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick meta */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {c.location}
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            {c.education}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Active {c.lastActive}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={onGenerateOutreach}
          >
            <Mail className="h-3.5 w-3.5" />
            Write message
          </Button>
          <Button
            size="sm"
            variant={inPipeline ? "secondary" : "outline"}
            className={cn("gap-1.5 text-xs", inPipeline && "text-accent")}
            onClick={!inPipeline ? onAddToPipeline : undefined}
            disabled={inPipeline}
          >
            {inPipeline ? (
              <>
                <Check className="h-3.5 w-3.5" />
                In Pipeline
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add to Pipeline
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Body sections */}
      <div className="space-y-0 px-6 py-5">
        {/* AI Reasoning */}
        <Section title="AI Reasoning">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/80">{c.reason}</p>
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {c.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground/80"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>

        {/* Experience */}
        <Section title="Experience">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium text-foreground">{c.role}</p>
            <p className="text-xs text-muted-foreground">{c.company} · {c.yearsExp} years experience</p>
          </div>
        </Section>

        {/* Education */}
        <Section title="Education">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-foreground">{c.education}</p>
          </div>
        </Section>

        {/*
          Team notes. The same panel the applicant board uses, on the same
          company-wide notes — so a hiring manager's comment about someone you
          sourced lands in one place whether they applied or you found them.
          Until now this existed only for applicants, which meant the people a
          recruiter went out and found were the ones nobody could discuss.
        */}
        <Section title="Team notes">
          {!c.id ? (
            <p className="text-sm text-muted-foreground">
              Notes open up once this search has been saved.
            </p>
          ) : onShortlist ? (
            <CandidateNotesPanel candidateId={c.id} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-sm text-foreground">Save {firstName(c.name)} first</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Notes are for people you are actually working with, so they open up
                once someone is on a shortlist or has applied to you.
              </p>
              {onAddToPipeline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={onAddToPipeline}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add to Pipeline
                </Button>
              )}
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 first:pt-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
