import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Copy, Edit3, Check, X, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { JobDescriptionContent } from "@/data/employer/HiringAssistant/Index";

interface JobDescriptionProps {
  roleTitle: string;
  content: JobDescriptionContent;
  onContentChange?: (content: JobDescriptionContent) => void;
}

export function JobDescription({ roleTitle, content, onContentChange }: JobDescriptionProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<JobDescriptionContent>(content);

  // Sync draft when content changes externally (new search)
  useEffect(() => { setDraft(content); }, [content]);

  const handleCopy = () => {
    const text = [
      roleTitle,
      "",
      "About the Role",
      draft.aboutRole,
      "",
      "What You'll Do",
      ...draft.responsibilities.map((r) => `• ${r}`),
      "",
      "What We're Looking For",
      ...draft.requirements.map((r) => `• ${r}`),
      "",
      "Nice to Have",
      ...draft.niceToHave.map((r) => `• ${r}`),
      "",
      "Compensation",
      draft.compensation,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Job description copied to clipboard");
  };

  const handleSave = () => {
    onContentChange?.(draft);
    setIsEditing(false);
    toast.success("Changes saved");
  };

  const handleDiscard = () => {
    setDraft(content);
    setIsEditing(false);
  };

  const handlePostJob = () => {
    navigate("/employers/jobs/post", {
      state: {
        prefill: {
          title: roleTitle,
          description: draft.aboutRole,
          requirements: draft.requirements,
          niceToHave: draft.niceToHave,
          responsibilities: draft.responsibilities,
          compensation: draft.compensation,
        },
      },
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {isEditing ? "Editing — click any section to change it" : "AI-generated · click Edit to modify"}
          </div>
          <h2 className="text-xl font-semibold text-foreground">{roleTitle}</h2>
        </div>

        <div className="flex shrink-0 gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleDiscard}>
                <X className="h-3.5 w-3.5" />
                Discard
              </Button>
              <Button size="sm" className="h-8 gap-1.5 bg-foreground text-xs text-background hover:bg-foreground/90" onClick={handleSave}>
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                Copy JD
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-foreground text-xs text-background hover:bg-foreground/90"
                onClick={handlePostJob}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Post This Job
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">

        <EditableSection title="About the Role">
          {isEditing ? (
            <textarea
              value={draft.aboutRole}
              onChange={(e) => setDraft((p) => ({ ...p, aboutRole: e.target.value }))}
              rows={5}
              className="w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-muted-foreground focus:outline-none focus:ring-0"
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{draft.aboutRole}</p>
          )}
        </EditableSection>

        <Divider />

        <EditableSection title="What You'll Do">
          {isEditing ? (
            <BulletTextarea
              items={draft.responsibilities}
              onChange={(items) => setDraft((p) => ({ ...p, responsibilities: items }))}
              accent
            />
          ) : (
            <BulletList items={draft.responsibilities} accent />
          )}
        </EditableSection>

        <Divider />

        <EditableSection title="What We're Looking For">
          {isEditing ? (
            <BulletTextarea
              items={draft.requirements}
              onChange={(items) => setDraft((p) => ({ ...p, requirements: items }))}
            />
          ) : (
            <BulletList items={draft.requirements} />
          )}
        </EditableSection>

        <Divider />

        <EditableSection title="Nice to Have">
          {isEditing ? (
            <BulletTextarea
              items={draft.niceToHave}
              onChange={(items) => setDraft((p) => ({ ...p, niceToHave: items }))}
              muted
            />
          ) : (
            <BulletList items={draft.niceToHave} muted />
          )}
        </EditableSection>

        <Divider />

        <EditableSection title="Compensation & Benefits">
          {isEditing ? (
            <input
              value={draft.compensation}
              onChange={(e) => setDraft((p) => ({ ...p, compensation: e.target.value }))}
              className="w-full border-0 bg-transparent text-sm font-medium text-foreground focus:outline-none focus:ring-0"
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{draft.compensation}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.benefits.map((benefit) => (
              <span
                key={benefit}
                className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs text-foreground/80"
              >
                {benefit}
              </span>
            ))}
          </div>
        </EditableSection>
      </div>

      {/* Post CTA footer — shown only in view mode */}
      {!isEditing && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Ready to publish? Post this role to start receiving applications.
          </p>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handlePostJob}>
            <ExternalLink className="h-3 w-3" />
            Post Job
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EditableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="mx-6 h-px bg-border" />;
}

function BulletList({ items, accent, muted }: { items: string[]; accent?: boolean; muted?: boolean }) {
  const dotClass = accent ? "bg-accent" : muted ? "bg-border" : "bg-foreground/40";
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function BulletTextarea({
  items,
  onChange,
  accent,
  muted,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  accent?: boolean;
  muted?: boolean;
}) {
  const dotClass = accent ? "bg-accent" : muted ? "bg-border" : "bg-foreground/40";
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground/70">One item per line</p>
      <div className="relative flex gap-2">
        <div className="flex flex-col gap-[1.6rem] pt-[5px]">
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          ))}
        </div>
        <textarea
          value={items.join("\n")}
          onChange={(e) =>
            onChange(e.target.value.split("\n").filter((s) => s.trim()))
          }
          rows={Math.max(items.length, 3)}
          className="flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed text-muted-foreground focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
}
