import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MAX_COLLABORATORS, suggestCollaborators } from "@/lib/api/community";

/** Someone picked to collaborate: a person by user id, or a company by its page's id. */
export interface PickedCollaborator {
  kind: "person" | "company";
  id: string;
  name: string;
  imageUrl: string | null;
  /** Set for someone already on a published post: asked, or accepted. */
  status?: "PENDING" | "ACCEPTED";
}

/**
 * "Add collaborators", as on LinkedIn: up to five people or company pages to
 * ask onto a post. Each is asked, and shows on the post once they accept.
 *
 * People are the ones you follow or who follow you (what LinkedIn calls
 * connections), listed before anything is typed; company pages are found by
 * name. Nothing is sent until Save — and, in the composer, until Post.
 */
export function CollaboratorPicker({
  open,
  onOpenChange,
  initial,
  onSave,
  saving = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PickedCollaborator[];
  onSave: (picked: PickedCollaborator[]) => void;
  saving?: boolean;
}) {
  const [picked, setPicked] = useState<PickedCollaborator[]>(initial);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");

  // Each opening starts from what the post has, not from an abandoned edit.
  useEffect(() => {
    if (!open) return;
    setPicked(initial);
    setQuery("");
    setTyped("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Asked once typing pauses, not on every key.
  useEffect(() => {
    const t = window.setTimeout(() => setTyped(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ["collaborator-suggestions", typed],
    queryFn: ({ signal }) => suggestCollaborators(typed, signal),
    enabled: open,
    staleTime: 30_000,
  });

  const isPicked = (kind: PickedCollaborator["kind"], id: string) => picked.some((p) => p.kind === kind && p.id === id);
  const full = picked.length >= MAX_COLLABORATORS;
  const results: PickedCollaborator[] = [
    ...(suggestions.data?.people ?? []).map((p) => ({ kind: "person" as const, id: p.id, name: p.name, imageUrl: p.avatarUrl })),
    ...(suggestions.data?.companies ?? []).map((c) => ({ kind: "company" as const, id: c.id, name: c.name, imageUrl: c.logoUrl })),
  ].filter((r) => !isPicked(r.kind, r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle>Add collaborators</DialogTitle>
          <DialogDescription className="text-xs">
            Invite up to {MAX_COLLABORATORS} people you follow or who follow you, or company pages. Each is asked, and
            shows on the post once they accept — then it appears on their profile or page too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 pt-4">
          <label className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 focus-within:border-foreground/30">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people and company pages"
              aria-label="Search people and company pages"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          {picked.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Picked">
              {picked.map((p) => (
                <li
                  key={`${p.kind}:${p.id}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-0.5 pr-1.5 text-xs"
                >
                  <CollaboratorImage item={p} className="h-5 w-5" />
                  <span className="max-w-[10rem] truncate font-medium">{p.name}</span>
                  {p.status && (
                    <span className="text-muted-foreground">{p.status === "PENDING" ? "· Invited" : "· Collaborating"}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPicked((all) => all.filter((x) => !(x.kind === p.kind && x.id === p.id)))}
                    aria-label={`Remove ${p.name}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-2 max-h-72 min-h-[8rem] overflow-y-auto px-2 pb-2">
          {suggestions.isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {typed
                ? `No one you can invite matches "${typed}".`
                : "People you follow or who follow you show up here. Search a company page by its name."}
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => setPicked((all) => [...all, r])}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CollaboratorImage item={r} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      {r.kind === "company" && <span className="block text-xs text-muted-foreground">Company page</span>}
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {full ? `That's the most: ${MAX_COLLABORATORS}.` : `${picked.length} of ${MAX_COLLABORATORS}`}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" className="rounded-full px-5" disabled={saving} onClick={() => onSave(picked)}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** A person's photo, or a company's logo in a rounded square, with initials until it loads. */
export function CollaboratorImage({ item, className }: { item: { kind: "person" | "company"; name: string; imageUrl: string | null }; className?: string }) {
  if (item.kind === "company") {
    return item.imageUrl ? (
      <img src={item.imageUrl} alt="" className={cn("shrink-0 rounded-md border border-border bg-background object-contain", className)} />
    ) : (
      <span className={cn("flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground", className)}>
        <Building2 className="h-3/5 w-3/5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage src={item.imageUrl ?? ""} alt="" />
      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
        {item.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
      </AvatarFallback>
    </Avatar>
  );
}

export default CollaboratorPicker;
