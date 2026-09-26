import { useEffect, useState } from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStoredResume, parseResumeFile } from "@/lib/api/interviewCoach";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

/** Rough years of experience from the earliest year mentioned across roles. */
function yearsFromExperiences(periods: string[]): number {
  const years = periods
    .flatMap((p) => p.match(/(19|20)\d{2}/g) ?? [])
    .map(Number)
    .filter((y) => y > 1950 && y <= new Date().getFullYear());
  if (years.length === 0) return 0;
  return Math.max(0, new Date().getFullYear() - Math.min(...years));
}

export default function StepResume() {
  const resume = useInterviewSetupStore((s) => s.config.resume);
  const set = useInterviewSetupStore((s) => s.set);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [reused, setReused] = useState(false);
  /** True when a stored resume exists but was set aside for this session. */
  const [skipped, setSkipped] = useState(false);
  /** Whether the account has a resume at all — decides upload vs. explain. */
  const [hasStored, setHasStored] = useState<boolean | null>(null);

  /**
   * There is one resume per person, and this reads it.
   *
   * This step used to be a second place to set one: uploading here posted to
   * the same endpoint as the profile, so "use a different file for this run"
   * silently replaced the resume sent with every job application — two entry
   * points quietly writing one value. Now an existing resume is shown read
   * only, managed in one place, and the only thing this step decides is
   * whether to use it for this session.
   */
  useEffect(() => {
    if (resume) return;
    let cancelled = false;
    void getStoredResume().then((stored) => {
      if (cancelled) return;
      setHasStored(!!stored);
      if (!stored) return;
      setReused(true);
      set({
        resume: {
          fileName: stored.fileName,
          skills: stored.skills ?? [],
          projects: stored.roles ?? [],
          experienceYears: stored.experienceYears ?? 0,
          quality: "medium",
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount — re-running on `resume` would undo a manual removal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is over 10MB — try a smaller export.");
      return;
    }
    setParsing(true);
    try {
      // Real extraction — only what the file actually contains.
      const parsed = await parseResumeFile(file);
      const projects = parsed.experiences
        .map((e) => [e.title, e.company].filter(Boolean).join(" · "))
        .filter(Boolean)
        .slice(0, 5);

      set({
        resume: {
          fileName: file.name,
          skills: parsed.skills ?? [],
          projects,
          experienceYears: yearsFromExperiences(parsed.experiences.map((e) => e.period ?? "")),
          quality: "medium", // unused by the UI; kept for the stored config shape
        },
      });
      setReused(false);
      setHasStored(true);
      setSkipped(false);
      toast.success(
        parsed.skills?.length
          ? `Saved to your profile — found ${parsed.skills.length} skill${parsed.skills.length === 1 ? "" : "s"}`
          : "Saved to your profile",
        { description: "This is now the resume used for applications and job matches too." },
      );
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that resume");
    } finally {
      setParsing(false);
    }
  };

  if (resume) {
    return (
      <div className="space-y-4">
        {/* File row */}
        <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
            <FileCheck2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{resume.fileName}</p>
            <p className="text-xs text-ink-dim">
              Your profile resume · used to personalize your questions ·{" "}
              <a
                href="/jobseeker/profile#resume"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-coral hover:underline"
              >
                manage it
              </a>
            </p>
          </div>
          <button
            onClick={() => {
              set({ resume: undefined });
              setReused(false);
              setSkipped(true);
            }}
            title="Don't use it for this session"
            aria-label="Don't use my resume for this session"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* What we actually extracted — no invented scores. */}
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-5">
          <p className="text-sm font-medium text-ink">What we found</p>

          {resume.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {resume.skills.slice(0, 12).map((s) => (
                <span key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-dim">
                  {s}
                </span>
              ))}
              {resume.skills.length > 12 && (
                <span className="px-1 py-1 text-xs text-ink-dim">+{resume.skills.length - 12} more</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-dim">
              No skills detected — the interviewer will rely on the role and level you chose.
            </p>
          )}

          {resume.projects.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-dim">Recent roles</p>
              <ul className="space-y-0.5">
                {resume.projects.slice(0, 3).map((p) => (
                  <li key={p} className="truncate text-xs text-ink-dim">
                    · {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.experienceYears > 0 && (
            <p className="text-xs text-ink-dim">
              ~{resume.experienceYears} year{resume.experienceYears === 1 ? "" : "s"} of experience found
            </p>
          )}
        </div>
      </div>
    );
  }

  /**
   * Set aside for this session only.
   *
   * Offered back rather than replaced with an upload box: the resume still
   * exists, and inviting another file here is exactly the second entry point
   * this step no longer is.
   */
  if (skipped && hasStored) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-surface p-5 text-center">
        <p className="text-sm font-medium text-ink">Not using your resume this time</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-ink-dim">
          Questions will come from the role and level you picked instead. Your resume is
          untouched and still used for applications and job matches.
        </p>
        <button
          onClick={() => {
            setSkipped(false);
            void getStoredResume().then((stored) => {
              if (!stored) return;
              setReused(true);
              set({
                resume: {
                  fileName: stored.fileName,
                  skills: stored.skills ?? [],
                  projects: stored.roles ?? [],
                  experienceYears: stored.experienceYears ?? 0,
                  quality: "medium",
                },
              });
            });
          }}
          className="mt-4 rounded-full border border-ink/15 bg-surface-2 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-coral hover:text-white"
        >
          Use it after all
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-coral bg-coral/10" : "border-ink/15 bg-surface hover:border-ink/30",
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2">
          {parsing ? (
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-coral/40 border-t-coral"
              aria-hidden="true"
            />
          ) : (
            <UploadCloud className="h-6 w-6 text-coral" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">
            {parsing ? "Analyzing your resume…" : "Drag and drop your resume"}
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            or <span className="font-medium text-coral">browse files</span> — PDF, DOC, DOCX up to 10MB
          </p>
          {/* Said plainly, because it is one resume: uploading here is the same
              act as uploading on the profile, and has the same consequences. */}
          <p className="mt-2 text-xs text-ink-dim">
            Saved to your profile and used everywhere — job matches, applications and this
            interview.
          </p>
        </div>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      <p className="text-center text-xs text-ink-dim">
        Optional — but the interviewer asks sharper, more personal questions with it.
      </p>
    </div>
  );
}
