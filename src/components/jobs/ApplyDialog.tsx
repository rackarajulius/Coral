import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, FileText, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToJob, uploadResumeForApplication } from "@/lib/api/applications";
import { getMyResumeFile, type StoredResumeFile } from "@/lib/api/interviewCoach";

interface ApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: { id: string; title: string; company: string };
  onApplied: (jobId: string) => void;
}

/**
 * Submits a real application. Shows exactly what will be sent — the stored
 * resume (with a preview link) plus the profile — and never claims to attach a
 * file the user has not uploaded.
 */
export default function ApplyDialog({ open, onOpenChange, job, onApplied }: ApplyDialogProps) {
  const [coverLetter, setCoverLetter] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<StoredResumeFile | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  // A resume chosen for THIS application only — the profile default is untouched.
  const [swapped, setSwapped] = useState<{ path: string; fileName: string; url: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getMyResumeFile().then((r) => {
      if (cancelled) return;
      setResumeFile(r);
      setResumeChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const chooseResume = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is over 10MB — try a smaller export.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadResumeForApplication(file);
      setSwapped(uploaded);
      toast.success("Resume attached to this application");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload that resume");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** What will actually be sent: the swapped file if chosen, else the default. */
  const active = swapped ?? (resumeFile?.fileName ? resumeFile : null);

  const submit = async () => {
    setSubmitting(true);
    try {
      const salary = Number(expectedSalary.replace(/[^\d]/g, ""));
      await applyToJob({
        jobId: job.id,
        coverLetter: coverLetter.trim() || undefined,
        expectedSalary: Number.isFinite(salary) && salary > 0 ? salary : undefined,
        availabilityDate: availableFrom ? new Date(availableFrom).toISOString() : undefined,
        resumePath: swapped?.path,
      });
      toast.success("Application sent", { description: `${job.title} · ${job.company}` });
      onApplied(job.id);
      onOpenChange(false);
      setCoverLetter("");
      setExpectedSalary("");
      setAvailableFrom("");
      setSwapped(null);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't submit your application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-coral" /> Apply to {job.title}
          </DialogTitle>
          <DialogDescription>
            {job.company} — your profile is shared with the employer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resume — shows exactly what will be sent, and lets you swap it. */}
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-sm">
                {!resumeChecked ? (
                  <span className="text-muted-foreground">Checking your resume…</span>
                ) : active ? (
                  <>
                    <p className="truncate font-medium text-foreground">{active.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {swapped ? "Used for this application only" : "Your default resume"} · sent with your{" "}
                      <Link to="/jobseeker/profile" className="text-coral hover:underline">
                        profile
                      </Link>
                      .{" "}
                      {active.url && (
                        <a
                          href={active.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-coral hover:underline"
                        >
                          Preview
                        </a>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">No resume attached</p>
                    <p className="text-xs text-muted-foreground">
                      Your{" "}
                      <Link to="/jobseeker/profile" className="text-coral hover:underline">
                        profile
                      </Link>{" "}
                      is still shared. Attach one below for this role, or{" "}
                      {/* Lands on the resume card itself rather than the top of
                          a long page. */}
                      <Link to="/jobseeker/profile#resume" className="text-coral hover:underline">
                        add a default resume
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>

              {resumeChecked && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={uploading || submitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="h-3 w-3" /> {active ? "Use another" : "Attach"}</>
                    )}
                  </Button>
                  {swapped && (
                    <button
                      type="button"
                      onClick={() => setSwapped(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Use default instead
                    </button>
                  )}
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void chooseResume(f);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover-letter">Cover note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="cover-letter"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Why you're a good fit for this role…"
              className="min-h-[120px] resize-y"
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expected-salary">
                Expected salary <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="expected-salary"
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                placeholder="e.g. 95000"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="available-from">
                Available from <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="available-from"
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Review the above — once sent, you can withdraw from{" "}
            <Link to="/activity" className="text-coral hover:underline">
              your activity
            </Link>
            , but not edit.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Submit application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
