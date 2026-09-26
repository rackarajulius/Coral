import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  addCandidateNote,
  addCandidateTag,
  deleteCandidateNote,
  getCandidateNotes,
  getCandidateTags,
  getTagsInUse,
  removeCandidateTag,
  type CandidateNote,
} from "@/lib/api/ats";
import { useMySeat } from "@/hooks/useMySeat";

/**
 * Internal notes and tags about one candidate.
 *
 * Replaces a tab that showed two invented notes from people who do not work
 * here, above a compose box whose "Add note" button showed a success toast and
 * saved nothing — so a recruiter's actual assessment was discarded while being
 * told it was kept.
 *
 * Everything here is company-private. The candidate never sees a note or a tag.
 */
export function CandidateNotesPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const notes = useQuery({
    queryKey: ["candidate-notes", candidateId],
    queryFn: () => getCandidateNotes(candidateId),
    retry: false,
  });

  const add = useMutation({
    mutationFn: (body: string) => addCandidateNote(candidateId, body),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] });
    },
    // Surfaced verbatim: the common refusal here is that the candidate never
    // reached this company, which the recruiter needs to read, not a shrug.
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-5">
      <TagStrip candidateId={candidateId} />

      <div>
        <div className="rounded-xl border border-border">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What did you make of them? Visible to your team only."
            rows={4}
            className="resize-none border-0 focus-visible:ring-0"
            maxLength={5000}
          />
          <div className="flex items-center justify-end border-t border-border px-2 py-1.5">
            <Button
              size="sm"
              onClick={() => add.mutate(draft.trim())}
              disabled={!draft.trim() || add.isPending}
            >
              {add.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Add note
            </Button>
          </div>
        </div>
      </div>

      {notes.isLoading && <Skeleton className="h-24 rounded-xl" />}

      {notes.isError && (
        <p className="text-sm text-destructive">{(notes.error as Error).message}</p>
      )}

      {notes.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No notes yet. The first one is usually the most useful.
        </p>
      )}

      <div className="space-y-3">
        {notes.data?.map((note) => (
          <NoteCard key={note.id} note={note} candidateId={candidateId} />
        ))}
      </div>
    </div>
  );
}

function NoteCard({ note, candidateId }: { note: CandidateNote; candidateId: string }) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => deleteCandidateNote(note.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-xs">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-primary-soft text-[10px] text-primary">
            {initials(note.authorName)}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{note.authorName}</span>
        <span className="text-muted-foreground">· {relativeTime(note.createdAt)}</span>
        {/* Only the author's own notes offer this — the server refuses the rest,
            so showing the control to everyone would just produce errors. */}
        {note.mine && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            aria-label="Delete this note"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
    </div>
  );
}

/** The company's own labels for this person. Never shown to the candidate. */
function TagStrip({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  /**
   * Tagging takes `candidates:write`; writing a note only takes
   * `candidates:comment`. An interviewer holds the second and not the first, so
   * they read the tags here and cannot change them — rather than being offered
   * a button whose only outcome is a refusal.
   */
  const { can } = useMySeat();
  const mayTag = can("candidates:write");

  const tags = useQuery({
    queryKey: ["candidate-tags", candidateId],
    queryFn: () => getCandidateTags(candidateId),
    retry: false,
  });

  // Suggestions come from what this company already uses, so a team converges
  // on one vocabulary instead of inventing "silver medalist" four ways.
  const inUse = useQuery({ queryKey: ["tags-in-use"], queryFn: getTagsInUse, retry: false });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["candidate-tags", candidateId] });
    void queryClient.invalidateQueries({ queryKey: ["tags-in-use"] });
  };

  const add = useMutation({
    mutationFn: (value: string) => addCandidateTag(candidateId, value),
    onSuccess: () => {
      setLabel("");
      setAdding(false);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (tagId: string) => removeCandidateTag(tagId),
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const existing = new Set((tags.data ?? []).map((t) => t.label));
  const suggestions = (inUse.data ?? [])
    .filter((s) => !existing.has(s.label))
    .slice(0, 6);

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <TagIcon className="h-3.5 w-3.5" aria-hidden="true" /> Tags
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {tags.data?.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
          >
            {tag.label}
            {mayTag && (
              <button
                type="button"
                onClick={() => remove.mutate(tag.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove tag ${tag.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        {!mayTag && tags.data?.length === 0 && (
          <span className="text-xs text-muted-foreground">No tags yet.</span>
        )}

        {!mayTag ? null : adding ? (
          <span className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && label.trim()) add.mutate(label.trim());
                if (e.key === "Escape") { setAdding(false); setLabel(""); }
              }}
              // Steers toward what tags are for. Status words ("Interviewed")
              // are refused by the server and pointed at the stage instead.
              placeholder="e.g. Strong referral"
              maxLength={40}
              className="h-7 w-36 text-xs"
            />
            <Button
              size="sm"
              className="h-7"
              onClick={() => label.trim() && add.mutate(label.trim())}
              disabled={!label.trim() || add.isPending}
            >
              Add
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" /> Tag
          </Button>
        )}
      </div>

      {adding && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => add.mutate(s.label)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default CandidateNotesPanel;
