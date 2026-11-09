import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, Loader2, UserRoundCheck, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import { personName } from "@/lib/personName";
import {
  answerCollaboration,
  companyPath,
  getPostCollaborators,
  personPath,
  setPostCollaborators,
  type CommunityPost,
  type ViewerCollaboration,
} from "@/lib/api/community";
import { usePersonFollow } from "./usePersonFollow";
import { CollaboratorImage, CollaboratorPicker, type PickedCollaborator } from "./CollaboratorPicker";

/** One row in the Collaborators list. */
interface Row {
  kind: "person" | "company";
  /** A person's user id, or a company's page id (null when its page is private). */
  id: string | null;
  name: string;
  imageUrl: string | null;
  author?: boolean;
}

/**
 * "with 2 others" on a post's byline, as on LinkedIn. Opens the Collaborators
 * list: whoever posted it, marked Author, then everyone who accepted. Only
 * accepted collaborators are counted or shown; an invitation nobody answered
 * is nobody else's business.
 */
export function CollaboratorsLine({ post }: { post: CommunityPost }) {
  const [open, setOpen] = useState(false);
  const others = post.collaborators ?? [];
  if (others.length === 0) return null;

  const rows: Row[] = [
    post.company
      ? { kind: "company", id: post.company.profiles?.[0]?.id ?? null, name: post.company.name, imageUrl: post.company.logoUrl ?? null, author: true }
      : { kind: "person", id: post.author.id, name: personName(post.author), imageUrl: post.author.avatarUrl ?? null, author: true },
    ...others.map((c): Row =>
      c.kind === "person"
        ? { kind: "person", id: c.id, name: c.name, imageUrl: c.avatarUrl }
        : { kind: "company", id: c.pageId, name: c.name, imageUrl: c.logoUrl },
    ),
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hover:underline">
        with {others.length} {others.length === 1 ? "other" : "others"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>Collaborators</DialogTitle>
            <DialogDescription className="sr-only">Who posted this, and who collaborates on it.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] overflow-y-auto py-2">
            {rows.map((row) => (
              <li key={`${row.kind}:${row.id ?? row.name}`} className="flex items-center gap-3 px-5 py-2.5">
                <CollaboratorImage item={row} className="h-10 w-10" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {row.id ? (
                    <Link
                      to={row.kind === "person" ? personPath(row.id) : companyPath(row.id)}
                      onClick={() => setOpen(false)}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium">{row.name}</span>
                  )}
                  {row.author && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Author</span>
                  )}
                </div>
                {row.id && <RowFollow row={row as Row & { id: string }} />}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowFollow({ row }: { row: Row & { id: string } }) {
  const { user } = useAuth();
  if (!user || (row.kind === "person" && row.id === user.id)) return null;
  return row.kind === "person" ? <PersonFollow personId={row.id} /> : <CompanyFollow pageId={row.id} />;
}

function PersonFollow({ personId }: { personId: string }) {
  const { isFollowing, isPending, toggle } = usePersonFollow(personId);
  return <FollowPill following={isFollowing} disabled={isPending} onClick={toggle} />;
}

function CompanyFollow({ pageId }: { pageId: string }) {
  const { isFollowing, isPending, toggle } = useFollowCompany({ companyId: pageId });
  return <FollowPill following={isFollowing} disabled={isPending} onClick={toggle} />;
}

function FollowPill({ following, disabled, onClick }: { following: boolean; disabled?: boolean; onClick: () => void }) {
  const Icon = following ? UserRoundCheck : UserRoundPlus;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={following}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        following ? "border border-border text-muted-foreground hover:text-foreground" : "bg-coral/10 text-coral hover:bg-coral/15",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {following ? "Following" : "Follow"}
    </button>
  );
}

/** After a collaboration changes: the post itself, and every list that may (no longer) hold it. */
function refreshAfterChange(queryClient: ReturnType<typeof useQueryClient>, postId: string) {
  void queryClient.invalidateQueries({ queryKey: ["community-post", postId] });
  void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
}

/**
 * On a post's own page, where an invitation is answered: Accept or Decline,
 * as yourself or for a company page you run. Once accepted, the way off it.
 */
export function CollaborationBanner({ post }: { post: CommunityPost }) {
  const queryClient = useQueryClient();
  const entries = post.viewerCollaboration ?? [];
  const answer = useMutation({
    mutationFn: ({ action, entry }: { action: "accept" | "decline" | "leave"; entry: ViewerCollaboration }) =>
      answerCollaboration(post.id, action, entry.as === "company" ? entry.companyId : undefined),
    onSuccess: (_state, { action, entry }) => {
      const whose = entry.as === "company" ? `${entry.name}'s page` : "your profile";
      toast.success(
        action === "accept"
          ? `You're on it. It now shows on ${whose} too.`
          : action === "decline"
            ? "Invitation declined."
            : entry.as === "company" ? `${entry.name} is off this post.` : "You're off this post.",
      );
      refreshAfterChange(queryClient, post.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (entries.length === 0) return null;

  const writer = post.company?.name ?? personName(post.author);
  return (
    <div className="mt-3 space-y-2">
      {entries.map((entry) => {
        const key = entry.as === "company" ? entry.companyId : "me";
        const busy = answer.isPending && answer.variables?.entry === entry;
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3" role="status">
            <Handshake className="h-5 w-5 shrink-0 text-coral" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">
              {entry.status === "PENDING" ? (
                entry.as === "company" ? (
                  <><strong>{writer}</strong> invited <strong>{entry.name}</strong> to collaborate on this post. Accept, and it shows on {entry.name}'s page with the company named on it.</>
                ) : (
                  <><strong>{writer}</strong> invited you to collaborate on this post. Accept, and it shows on your profile with you named on it.</>
                )
              ) : entry.as === "company" ? (
                <><strong>{entry.name}</strong> collaborates on this post.</>
              ) : (
                <>You collaborate on this post. It shows on your profile.</>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              {entry.status === "PENDING" ? (
                <>
                  <Button size="sm" variant="outline" className="rounded-full" disabled={answer.isPending} onClick={() => answer.mutate({ action: "decline", entry })}>
                    Decline
                  </Button>
                  <Button size="sm" className="rounded-full px-5" disabled={answer.isPending} onClick={() => answer.mutate({ action: "accept", entry })}>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Accept
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="rounded-full" disabled={answer.isPending} onClick={() => answer.mutate({ action: "leave", entry })}>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {entry.as === "company" ? `Remove ${entry.name}` : "Remove myself"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Remove myself from this post", from a post's menu, for a person who
 * collaborates on it. (A company page is taken off from the post's own page,
 * where its admins see the banner.)
 */
export function useLeaveCollaboration(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => answerCollaboration(postId, "leave"),
    onSuccess: () => {
      toast.success("You're off this post. It no longer shows on your profile.");
      refreshAfterChange(queryClient, postId);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

/** "Edit collaborators" after posting: who's on it and who's still asked, changed in the same picker. */
export function ManageCollaboratorsDialog({ postId, open, onOpenChange }: { postId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["post-collaborators", postId],
    queryFn: () => getPostCollaborators(postId),
    enabled: open,
  });
  const save = useMutation({
    mutationFn: (picked: PickedCollaborator[]) => setPostCollaborators(postId, picked.map((p) => ({ kind: p.kind, id: p.id }))),
    onSuccess: (after) => {
      queryClient.setQueryData(["post-collaborators", postId], after);
      const before = new Set((current.data ?? []).map((c) => `${c.kind}:${c.id}`));
      const invited = after.filter((c) => !before.has(`${c.kind}:${c.id}`)).length;
      toast.success(invited > 0 ? `Saved. ${invited === 1 ? "1 invitation" : `${invited} invitations`} sent.` : "Collaborators saved.");
      refreshAfterChange(queryClient, postId);
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (open && current.isLoading) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xs">
          <DialogTitle className="sr-only">Loading collaborators</DialogTitle>
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // A company is named by its page, as the picker names it — or, when its page
  // has gone private, by the company itself, which the server keeps as it is.
  const initial: PickedCollaborator[] = (current.data ?? []).map((c): PickedCollaborator =>
    c.kind === "person"
      ? { kind: "person", id: c.id, name: c.name, imageUrl: c.avatarUrl, status: c.status }
      : { kind: "company", id: c.pageId ?? c.id, name: c.name, imageUrl: c.logoUrl, status: c.status },
  );
  return (
    <CollaboratorPicker
      open={open && !current.isLoading}
      onOpenChange={onOpenChange}
      initial={initial}
      saving={save.isPending}
      onSave={(picked) => save.mutate(picked)}
    />
  );
}
