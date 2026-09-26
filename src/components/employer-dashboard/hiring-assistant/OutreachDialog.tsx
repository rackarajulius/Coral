import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Send,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Loader2,
  FileText,
  BookmarkPlus,
  AlertTriangle,
  Clock,
  CalendarClock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Candidate } from "@/data/employer/HiringAssistant/Index";
import {
  cancelScheduledOutreach,
  draftOutreach,
  getOutreachTiming,
  outreachFromTemplate,
  sendOutreach,
} from "@/lib/api/hiring";
import { createTemplate, getTemplates } from "@/lib/api/ats";
import { useMySeat } from "@/hooks/useMySeat";

interface OutreachDialogProps {
  candidate: Candidate | null;
  /** The role/query being hired for — grounds the AI draft. */
  role?: string;
  /**
   * A short role name for `{{job_title}}` in templates — the project's name or
   * inferred role. A sourced candidate has no job to take it from.
   */
  roleTitle?: string;
  onClose: () => void;
  /** Called the moment the message is sent (before the dialog closes). */
  onSent?: () => void;
}

const TONES = ["warm", "direct", "concise"] as const;
const AI = "ai";
/** The server's cap on an outreach message. Templates may be longer. */
const MAX_MESSAGE = 5000;
/** Remembers where the recruiter last started, so a team that uses templates isn't sent to the AI every time. */
const SOURCE_KEY = "coral:outreach-source";
/** Template kinds that make sense for approaching someone who hasn't applied. */
const OUTREACH_CATEGORIES = new Set(["outreach", "general"]);

const placeholders = (text: string) => [...new Set(text.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [])];

function readSource(): string {
  try {
    return localStorage.getItem(SOURCE_KEY) || AI;
  } catch {
    return AI;
  }
}

function writeSource(value: string) {
  try {
    localStorage.setItem(SOURCE_KEY, value);
  } catch {
    /* private mode — remembering is a nicety */
  }
}

/** Turns this candidate's name back into the token, so a saved template fits the next person. */
function tokenise(text: string, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = text;
  if (fullName.trim()) out = out.replace(new RegExp(escape(fullName.trim()), "g"), "{{candidate_name}}");
  // First name alone, as a whole word — "Sam" but not "Samsung".
  if (first.length > 1) out = out.replace(new RegExp(`\\b${escape(first)}\\b`, "g"), "{{candidate_name}}");
  return out;
}

export function OutreachDialog({ candidate, role, roleTitle, onClose, onSent }: OutreachDialogProps) {
  const queryClient = useQueryClient();
  const { can } = useMySeat();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [toneIndex, setToneIndex] = useState(0);
  const [source, setSource] = useState<string>(AI);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Only outreach-shaped templates: a rejection letter is not how you approach someone.
  const templatesQuery = useQuery({
    queryKey: ["email-templates"],
    queryFn: getTemplates,
    enabled: Boolean(candidate),
    retry: false,
    staleTime: 60_000,
  });
  const templates = (templatesQuery.data ?? []).filter((t) => OUTREACH_CATEGORIES.has(t.category));
  const templatesSettled = templatesQuery.isFetched || templatesQuery.isError;

  const draftMut = useMutation({
    mutationFn: (tone: string) => draftOutreach(candidate!.id!, role, tone),
    onSuccess: (d) => {
      setSubject(d.subject);
      setMessage(d.message);
    },
  });

  const templateMut = useMutation({
    mutationFn: (templateId: string) =>
      outreachFromTemplate({ templateId, candidateId: candidate!.id!, jobTitle: roleTitle?.trim() || undefined }),
    onSuccess: (d) => {
      setSubject(d.subject);
      setMessage(d.message);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /** Their local time and working hours — from their own browser's timezone. */
  const timingQuery = useQuery({
    queryKey: ["outreach-timing", candidate?.id],
    queryFn: () => getOutreachTiming(candidate!.id!),
    enabled: Boolean(candidate?.id),
    retry: false,
    // Local time moves; a minute-old answer is fine, an hour-old one is not.
    staleTime: 60_000,
  });
  const timing = timingQuery.data;
  const canSchedule = !!timing?.known && !timing.goodNow && !!timing.suggestedAt;

  const sendMut = useMutation({
    mutationFn: (scheduledFor?: string) =>
      sendOutreach({ candidateId: candidate!.id!, role, subject, message, ...(scheduledFor ? { scheduledFor } : {}) }),
    onSuccess: () => {
      setSent(true);
      onSent?.();
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelScheduledOutreach(id),
    onSuccess: () => {
      toast.success("Cancelled — it won't be sent.");
      onSent?.();
      handleClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /** A moment in the recruiter's own time, for "(Thu 02:00 yours)". */
  const yours = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const saveMut = useMutation({
    mutationFn: () =>
      createTemplate({
        name: templateName.trim(),
        subject: tokenise(subject, candidate?.name ?? ""),
        body: tokenise(message, candidate?.name ?? ""),
        category: "outreach",
      }),
    onSuccess: (t) => {
      toast.success(`Saved "${t.name}" — it's in your templates now.`);
      setSaving(false);
      setTemplateName("");
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setSource(t.id);
      writeSource(t.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const start = (from: string) => {
    if (!candidate?.id) return;
    setSubject("");
    setMessage("");
    if (from === AI) draftMut.mutate(TONES[0]);
    else templateMut.mutate(from);
  };

  /**
   * Fill the message when a candidate opens the dialog — from the template the
   * recruiter last used if it still exists, otherwise an AI draft. Waits for
   * the template list, so a team that uses templates doesn't pay for an AI
   * call it is about to throw away.
   */
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!candidate?.id) {
      setOpenedFor(null);
      return;
    }
    if (openedFor === candidate.id || !templatesSettled) return;
    setOpenedFor(candidate.id);
    setToneIndex(0);
    setCopied(false);
    setSent(false);
    setSaving(false);
    const remembered = readSource();
    const from = remembered !== AI && templates.some((t) => t.id === remembered) ? remembered : AI;
    setSource(from);
    start(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id, templatesSettled]);

  const chooseSource = (value: string) => {
    setSource(value);
    writeSource(value);
    start(value);
  };

  const handleRegenerate = () => {
    if (!candidate?.id) return;
    const next = (toneIndex + 1) % TONES.length;
    setToneIndex(next);
    draftMut.mutate(TONES[next]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setSent(false);
    setSaving(false);
    onClose();
  };

  const noId = !!candidate && !candidate.id;
  const loading = draftMut.isPending || templateMut.isPending || (!!candidate?.id && !openedFor);
  const unfilled = placeholders(`${subject}\n${message}`);
  const tooLong = message.length > MAX_MESSAGE;
  const canSend =
    !!candidate?.id &&
    !loading &&
    !sendMut.isPending &&
    !!subject.trim() &&
    !!message.trim() &&
    unfilled.length === 0 &&
    !tooLong;
  const usingAi = source === AI;

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg gap-4">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-muted/40">
              {usingAi ? (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-accent" />
              )}
            </div>
            <DialogTitle className="text-sm font-semibold">Outreach message</DialogTitle>
          </div>
          {candidate && (
            <DialogDescription className="text-xs text-muted-foreground">
              To <span className="font-medium text-foreground">{candidate.name}</span>
              {" · "}
              {candidate.role} at {candidate.company}
            </DialogDescription>
          )}
        </DialogHeader>

        {noId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This candidate can't be contacted from here.
          </p>
        ) : sent ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            {sendMut.data?.scheduledFor ? (
              <div>
                <p className="text-sm font-semibold text-foreground">Scheduled for {candidate?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  It arrives {timing?.suggestedLocal ? `${timing.suggestedLocal} their time` : "at the time you chose"}
                  {" "}({yours(sendMut.data.scheduledFor)} yours), in-app and by email where possible. It won't
                  appear to them before then, and your team sees it as already on its way.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">Message sent to {candidate?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  They'll get it in-app
                  {sendMut.data?.channel === "both" ? " and by email" : ""}. You'll be notified if they reply.
                </p>
              </div>
            )}
            <div className="mt-1 flex gap-2">
              {sendMut.data?.scheduledFor && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => cancelMut.mutate(sendMut.data!.id)}
                  disabled={cancelMut.isPending}
                >
                  {cancelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel it"}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">Start from</span>
              <Select value={source} onValueChange={chooseSource} disabled={loading}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AI} className="text-xs">
                    AI draft, personalised
                  </SelectItem>
                  {templates.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-[11px]">Your templates</SelectLabel>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {timing && (
              <p
                className={
                  timing.known && !timing.goodNow
                    ? "flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                    : "flex items-start gap-1.5 text-xs text-muted-foreground"
                }
              >
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {timing.reason}
                  {canSchedule && timing.suggestedAt && ` That's ${yours(timing.suggestedAt)} for you.`}
                </span>
              </p>
            )}

            {loading && !message ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {usingAi ? "Drafting a personalised message…" : "Filling in the template…"}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="text-sm font-medium"
                />
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={11}
                  className="resize-none text-sm leading-relaxed"
                />
              </div>
            )}

            {unfilled.length > 0 && !loading && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Replace {unfilled.join(", ")} before sending
                  {unfilled.some((u) => /job_title/i.test(u)) &&
                    " — this person hasn't applied to a job, so write in the role you're approaching them about"}
                  .
                </span>
              </p>
            )}
            {tooLong && (
              <p className="text-xs text-destructive">
                {message.length.toLocaleString()} characters — outreach is limited to {MAX_MESSAGE.toLocaleString()}.
              </p>
            )}
            {sendMut.isError && (
              <p className="text-xs text-destructive">
                {(sendMut.error as Error)?.message || "Couldn't send. Try again."}
              </p>
            )}

            {saving && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                <Input
                  autoFocus
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && templateName.trim()) saveMut.mutate();
                    if (e.key === "Escape") setSaving(false);
                  }}
                  placeholder="Template name"
                  maxLength={80}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => saveMut.mutate()}
                  disabled={!templateName.trim() || saveMut.isPending}
                >
                  {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSaving(false)}>
                  Cancel
                </Button>
              </div>
            )}
            {saving && candidate?.name && (
              <p className="-mt-2 text-[11px] text-muted-foreground">
                "{candidate.name.split(/\s+/)[0]}" will be saved as {"{{candidate_name}}"}, so it fits the next person.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {message.length} chars{usingAi ? ` · tone: ${TONES[toneIndex]}` : ""}
                </p>
                {can("candidates:write") && !saving && message.trim() && (
                  <button
                    type="button"
                    onClick={() => setSaving(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    title="Save this message as a reusable template"
                  >
                    <BookmarkPlus className="h-3 w-3" /> Save as template
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {usingAi && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleRegenerate}
                    disabled={loading}
                  >
                    {draftMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Regenerate
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                {canSchedule ? (
                  <>
                    {/* Their working hours are the suggestion; sending now stays one click away. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => sendMut.mutate(undefined)}
                      disabled={!canSend}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send now
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-foreground text-xs text-background hover:bg-foreground/90"
                      onClick={() => sendMut.mutate(timing!.suggestedAt!)}
                      disabled={!canSend}
                      title={`Arrives ${timing!.suggestedLocal} their time`}
                    >
                      {sendMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5" />
                      )}
                      Schedule for {timing!.suggestedLocal}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-foreground text-xs text-background hover:bg-foreground/90"
                    onClick={() => sendMut.mutate(undefined)}
                    disabled={!canSend}
                  >
                    {sendMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send message
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
