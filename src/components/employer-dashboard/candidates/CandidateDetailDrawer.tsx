import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserRound, Video as VideoIcon, Bot, Loader2 } from "lucide-react";
import { startConversation } from "@/lib/api/messaging";
import { useMessageStore } from "@/stores/messageStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeInterview, getEmployerInterviews } from "@/lib/api/hiring";
import { getGoogleStatus, connectGoogleWithPopup } from "@/lib/api/googleIntegration";
import { inviteScreen, getScreensForCandidate, getScreenScorecard } from "@/lib/api/aiScreen";
import { AccommodationNotes, IntegrityNotes, ScreenScorecard } from "./ScreenScorecard";
import { InterviewScorecardBlock } from "./InterviewScorecardBlock";
import { CandidateNotesPanel } from "./CandidateNotesPanel";
import { OutreachHistoryBlock } from "./OutreachHistoryBlock";
import { ReactionButtons } from "./ReactionButtons";
import { OfferBlock } from "./OfferBlock";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Sparkles,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  CalendarPlus,
  ChevronRight,
  X,
  Plus,
  ThumbsUp,
  Clock,
  MessageSquare,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UNDERLINE_TABS_LIST, EMPLOYER_UNDERLINE_TAB_TRIGGER } from "@/lib/tabStyles";
import { toast } from "sonner";
import type { Candidate, Stage, TimelineEvent } from "@/data/employer/Candidates/types";
import { STAGES } from "@/data/employer/Candidates/types";
import { matchTone, formatRelative, DRAWER_CLOSE_MS } from "./candidateUtils";

interface CandidateDetailDrawerProps {
  candidate: Candidate | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose: () => void;
  onAdvance: (id: string, nextStage: Stage) => void;
  onReject: (id: string) => void;
  /** Whether this seat may move people through the pipeline. */
  canMove?: boolean;
  onStatusChange?: (id: string, status: Candidate["status"]) => void;
  onSchedule: (id: string, details: { date: string; time: string; interviewType: string; note: string }) => void;
}

function timelineIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "interview": return <CalendarPlus className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />;
    case "stage":     return <ChevronRight  className="h-2.5 w-2.5 text-primary" />;
    case "message":   return <MessageSquare className="h-2.5 w-2.5 text-primary" />;
    case "note":      return <FileText      className="h-2.5 w-2.5 text-primary" />;
    default:          return <Clock         className="h-2.5 w-2.5 text-primary" />;
  }
}

export function CandidateDetailPanel({
  candidate,
  open,
  onOpenChange,
  onClose,
  onAdvance,
  onReject,
  canMove = true,
  onStatusChange,
  onSchedule,
}: CandidateDetailDrawerProps) {
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("10:00");
  const [interviewType, setInterviewType] = useState<"Phone" | "Video" | "In-person">("Video");
  const [schedNote, setSchedNote] = useState("");

  const isOpen = open ?? !!candidate;
  const [displayed, setDisplayed] = useState<Candidate | null>(null);

  useEffect(() => {
    if (candidate) setDisplayed(candidate);
  }, [candidate]);

  useEffect(() => {
    if (!isOpen && displayed) {
      const t = window.setTimeout(() => setDisplayed(null), DRAWER_CLOSE_MS);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, displayed]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (!next) onClose();
  };

  if (!displayed) return null;
  const c = displayed;

  const stageIndex = STAGES.indexOf(c.stage);
  const nextStage = stageIndex >= 0 && stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;

  return (
    <>
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-br from-primary-soft/60 via-background to-background px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 ring-4 ring-background shadow-elevation-sm">
                <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                  {c.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{c.name}</h2>
                <p className="text-sm text-muted-foreground">Applied for {c.role}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="border-0 bg-background text-foreground">
                    {c.stage}
                  </Badge>
                  {c.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="border-0 bg-background/70 text-foreground">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  {(["Active", "On hold", "Withdrawn"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onStatusChange?.(c.id, s)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        c.status === s
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {/*
              Withheld, not missing. Someone the company sourced has shared
              nothing with it — messages go through Coral until they answer —
              and an empty row beside a mail icon reads as a broken record
              rather than a deliberate boundary.
            */}
            <span className="flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {c.email || (c.source === "sourced" ? "Not shared yet" : "—")}
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {c.phone || (c.source === "sourced" ? "Not shared yet" : "—")}
            </span>
            <span className="flex items-center gap-1.5 truncate"><Building2 className="h-3.5 w-3.5" /> {c.currentRole} · {c.currentCompany}</span>
            <span className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5" /> {c.location}</span>
          </div>

          {/* The team's quick verdicts, and this reviewer's own. Hovering
              names who thought what, which is the part that helps. */}
          {c.applicantId && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Team read:</span>
              <ReactionButtons candidateId={c.applicantId} initial={c.reactions} />
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.applicantId && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/profile/${c.applicantId}`} target="_blank" rel="noopener noreferrer">
                  <UserRound className="h-3.5 w-3.5" /> View full profile
                </Link>
              </Button>
            )}
            {c.applicantId && <MessageCandidateButton candidateId={c.applicantId} />}
            {/* Advancing and rejecting are decisions. Everything else in this
                row — viewing, messaging, scheduling, joining a room — a
                comment-only seat may legitimately do. */}
            {canMove && nextStage && (
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  onAdvance(c.id, nextStage);
                  toast.success(`Moved to ${nextStage}`);
                }}
              >
                Move to {nextStage} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="default" onClick={() => setSchedulingOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Schedule interview
            </Button>
            {c.applicantId && <EmployerJoinRoom candidateId={c.applicantId} />}
            {canMove && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  onReject(c.id);
                  toast("Candidate rejected", { description: c.name });
                }}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ai" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={cn(UNDERLINE_TABS_LIST, "mx-6 mt-4 w-auto")}>
            {[
              { value: "ai", label: "AI Insights" },
              { value: "resume", label: "Resume" },
              { value: "activity", label: "Activity" },
              { value: "notes", label: "Notes" },
            ].map((t) => (
              <TabsTrigger key={t.value} value={t.value} className={EMPLOYER_UNDERLINE_TAB_TRIGGER}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5">
              {/* AI Insights */}
              <TabsContent value="ai" className="mt-0 space-y-5">
                {/* What we have already said to them, before anyone says it
                    again. Keyed on the person, not the application, because
                    an approach predates any application. */}
                {c.applicantId && <OutreachHistoryBlock candidateId={c.applicantId} />}
                {c.applicantId && <AiScreeningBlock candidateId={c.applicantId} role={c.role} />}
                {c.applicantId && <InterviewScorecardBlock candidateId={c.applicantId} />}
                {/*
                  c.id is the application id — an offer is always for a role, so
                  it hangs off the application rather than the person. A sourced
                  candidate has no application, and this board now shows those
                  too: their id is a shortlist card, which these endpoints would
                  reject.
                */}
                {c.source !== "sourced" && (
                  <OfferBlock applicationId={c.id} candidateName={c.name} />
                )}

                <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft/40 to-background p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Skill Match</div>
                        <div className="text-2xl font-semibold tabular-nums">
                          {c.matchScore == null ? "—" : c.matchScore}
                          {c.matchScore != null && <span className="text-base text-muted-foreground">/100</span>}
                        </div>
                      </div>
                    </div>
                    <div className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", matchTone(c.matchScore))}>
                      {c.matchScore == null
                        ? "No skills listed on job"
                        : c.matchScore >= 90 ? "Excellent fit" : c.matchScore >= 80 ? "Strong fit" : c.matchScore >= 70 ? "Possible fit" : "Weak fit"}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/80">{c.summary}</p>
                </div>

                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {c.skills.map((s) => (
                      <span
                        key={s.name}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                          // Highlighted = genuinely listed on the job (real overlap, not a fabricated %).
                          s.match != null && s.match >= 90
                            ? "bg-primary-soft text-primary ring-primary/20"
                            : "bg-muted text-muted-foreground ring-border",
                        )}
                      >
                        {s.name}
                        {s.match != null && s.match >= 90 && " ✓"}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">✓ = listed in the job's required skills</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border p-4">
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <ThumbsUp className="h-3.5 w-3.5" /> Top strengths
                    </h4>
                    {c.strengths.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No AI assessment yet.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {c.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> Potential concerns
                    </h4>
                    {c.concerns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No concerns flagged.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {c.concerns.map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Resume */}
              <TabsContent value="resume" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{c.name.toLowerCase().replace(/\s/g, "-")}-resume.pdf</span>
                  </div>
                  {c.resumeUrl && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(c.resumeUrl, "_blank", "noopener,noreferrer")}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = c.resumeUrl!;
                          a.download = `${c.name.toLowerCase().replace(/\s/g, "-")}-resume.pdf`;
                          a.target = "_blank";
                          a.rel = "noopener noreferrer";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  )}
                </div>

                {c.resumeUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/20" style={{ height: 500 }}>
                    <iframe
                      src={c.resumeUrl}
                      title={`${c.name} resume`}
                      className="h-full w-full"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
                    <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No resume on file</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">The candidate hasn't uploaded a resume yet</p>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experience</h4>
                  <ul className="space-y-2">
                    {c.experience.map((e, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                        <div>
                          <div className="font-medium">{e.title} · {e.company}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">{e.period}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Education</h4>
                  <ul className="space-y-2">
                    {c.education.map((e, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                        <div>
                          <div className="font-medium">{e.school}</div>
                          <div className="text-xs text-muted-foreground">{e.degree}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">{e.year}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity" className="mt-0">
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {c.timeline.map((t) => (
                    <li key={t.id} className="relative">
                      <span className={cn(
                        "absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background",
                        t.type === "interview" ? "bg-emerald-500/10" : "bg-primary-soft"
                      )}>
                        {timelineIcon(t.type)}
                      </span>
                      <div className="text-sm font-medium">{t.text}</div>
                      <div className="text-xs text-muted-foreground">{formatRelative(t.at)}</div>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes" className="mt-0">
                {/* Real, per-author notes and company tags. What stood here
                    was two invented notes above a compose box that toasted
                    "Note added" and saved nothing. */}
                {c.applicantId ? (
                  <CandidateNotesPanel candidateId={c.applicantId} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Notes need a linked candidate account.
                  </p>
                )}
              </TabsContent>

            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>

    <Dialog
      open={schedulingOpen}
      onOpenChange={(open) => {
        setSchedulingOpen(open);
        if (!open) { setSchedDate(""); setSchedNote(""); }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule interview · {c.name.split(" ")[0]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label>Interview type</Label>
            <div className="flex gap-2">
              {(["Phone", "Video", "In-person"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInterviewType(t)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                    interviewType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {interviewType === "Video" && c.applicantId && <GoogleMeetHint />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                value={schedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSchedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-time">Time</Label>
              <Input
                id="sched-time"
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="sched-note"
              placeholder="e.g. Technical round — system design focus"
              value={schedNote}
              onChange={(e) => setSchedNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setSchedulingOpen(false)}>Cancel</Button>
          <Button
            disabled={!schedDate || !schedTime}
            onClick={() => {
              // Real applicants get an actual invitation (in-app + email) they
              // can accept or decline from their activity page.
              if (c.applicantId) {
                const slot = new Date(`${schedDate}T${schedTime}`).toISOString();
                proposeInterview({
                  candidateId: c.applicantId,
                  role: c.role,
                  medium: interviewType === "Phone" ? "phone" : interviewType === "In-person" ? "onsite" : "video",
                  proposedSlots: [slot],
                  message: schedNote || undefined,
                }).catch(() => toast.error("Couldn't send the interview invitation"));
              }
              onSchedule(c.id, { date: schedDate, time: schedTime, interviewType, note: schedNote });
              setSchedulingOpen(false);
              setSchedDate("");
              setSchedNote("");
              toast.success(
                c.applicantId
                  ? `Interview invitation sent to ${c.name.split(" ")[0]}`
                  : `Interview scheduled with ${c.name.split(" ")[0]}`,
              );
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/** AI screening — invite, awaiting-response status, or the completed scorecard. */
function AiScreeningBlock({ candidateId, role }: { candidateId: string; role: string }) {
  const queryClient = useQueryClient();
  const { data: screens } = useQuery({
    queryKey: ["ai-screens", candidateId],
    queryFn: () => getScreensForCandidate(candidateId),
    staleTime: 30_000,
  });
  const latest = screens?.[0];

  const inviteMut = useMutation({
    mutationFn: (mode: "text" | "video") => inviteScreen({ candidateId, role, mode }),
    onSuccess: (_d, mode) => {
      toast.success(`${mode === "video" ? "Video" : "AI"} screening invite sent`);
      queryClient.invalidateQueries({ queryKey: ["ai-screens", candidateId] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't send screening"),
  });

  // Fetch the scorecard once the latest screen is completed.
  const { data: scorecard } = useQuery({
    queryKey: ["ai-screen-scorecard", latest?.id],
    queryFn: () => getScreenScorecard(latest!.id),
    enabled: !!latest && latest.status === "completed",
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" /> AI screening
        </h4>
        {(!latest || latest.status === "declined") && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => inviteMut.mutate("text")} disabled={inviteMut.isPending}>
              {inviteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              Text
            </Button>
            <Button size="sm" variant="outline" onClick={() => inviteMut.mutate("video")} disabled={inviteMut.isPending}>
              <VideoIcon className="h-3.5 w-3.5" /> Video
            </Button>
          </div>
        )}
      </div>

      {latest?.status === "invited" && (
        <p className="mt-2 text-sm text-muted-foreground">
          {latest.mode === "video" ? "Video" : "AI"} screening sent — awaiting the candidate's response.
        </p>
      )}
      {latest?.status === "declined" && (
        <p className="mt-2 text-sm text-muted-foreground">The candidate declined the previous screening.</p>
      )}
      {latest?.status === "completed" && !scorecard && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading {latest.mode === "video" ? "video answers" : "scorecard"}…
        </p>
      )}

      {scorecard?.videoAnswers && scorecard.videoAnswers.length > 0 && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">The candidate recorded video answers. Watch below.</p>
          {scorecard.videoAnswers.map((v, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-foreground mb-2">
                <span className="text-primary mr-1">{i + 1}.</span>{v.question}
              </p>
              {v.videoUrl ? (
                <video src={v.videoUrl} controls playsInline className="w-full rounded-md bg-black aspect-video" />
              ) : (
                <p className="text-xs text-muted-foreground">Video unavailable.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {scorecard?.evaluation && (
        <div className="mt-4 space-y-4">
          <AccommodationNotes accommodations={scorecard.accommodations} />
          <ScreenScorecard evaluation={scorecard.evaluation} />
          <IntegrityNotes integrity={scorecard.integrity} />
        </div>
      )}
    </div>
  );
}

/** Opens (or reopens) an in-app message thread with this applicant, then jumps to Messages. */
function MessageCandidateButton({ candidateId }: { candidateId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await startConversation(candidateId);
          useMessageStore.getState().setActiveConversation(id);
          navigate("/employers/chat");
        } catch (e) {
          toast.error((e as Error).message || "Couldn't open the conversation");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Message
    </Button>
  );
}

/** Employer entry to the native video room — shown when a confirmed video interview exists. */
function EmployerJoinRoom({ candidateId }: { candidateId: string }) {
  const { data } = useQuery({
    queryKey: ["employer-interviews"],
    queryFn: getEmployerInterviews,
    staleTime: 60_000,
  });
  const joinable = (data ?? []).find(
    (i) => i.candidateId === candidateId && i.status === "confirmed" && i.medium === "video",
  );
  if (!joinable) return null;
  return (
    <Button size="sm" variant="outline" asChild>
      <Link to={`/interview/${joinable.id}/room`} target="_blank" rel="noopener noreferrer">
        <VideoIcon className="h-3.5 w-3.5" /> Join video room
      </Link>
    </Button>
  );
}

/** Google Meet status hint inside the schedule dialog (video interviews). */
function GoogleMeetHint() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["google-integration", "status"],
    queryFn: getGoogleStatus,
    staleTime: 5 * 60 * 1000,
  });

  const connectMut = useMutation({
    mutationFn: connectGoogleWithPopup,
    onSuccess: (result) => {
      if (result === "connected") {
        toast.success("Google Calendar connected", {
          description: "Video interviews will get a Meet link automatically.",
        });
        queryClient.invalidateQueries({ queryKey: ["google-integration", "status"] });
      } else if (result === "error") {
        toast.error("Google Calendar connection failed");
      }
      // "dismissed" — user closed the popup; stay quiet.
    },
    onError: () => toast.error("Google integration isn't configured"),
  });

  if (!status?.configured) return null;

  if (status.connected) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <VideoIcon className="h-3.5 w-3.5 text-emerald-500" />
        A Google Meet link will be added automatically when they accept
        {status.email ? ` (${status.email})` : ""}.
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <VideoIcon className="h-3.5 w-3.5" />
      <button
        type="button"
        className="underline underline-offset-2 hover:text-foreground disabled:opacity-60"
        onClick={() => connectMut.mutate()}
        disabled={connectMut.isPending}
      >
        {connectMut.isPending ? "Connecting…" : "Connect Google Calendar"}
      </button>
      to auto-add a Meet link when they accept.
    </p>
  );
}
