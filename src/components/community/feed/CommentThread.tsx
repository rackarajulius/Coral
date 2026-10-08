import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowUpDown, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IdentityLine } from "./IdentityLine";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  addComment, authorName, deleteComment, listComments, timeAgo,
  type CommentSort, type CommunityComment,
} from "@/lib/api/community";

/**
 * Ordering people can actually have.
 *
 * No "Top": comments carry no likes, so a popularity sort would rank by
 * nothing. Most-replied measures the same instinct — which comment started a
 * conversation — and is real.
 */
const SORTS: { key: CommentSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "replies", label: "Most replies" },
];

export function CommentThread({
  postId,
  postAuthorId,
}: {
  postId: string;
  /** So the original poster's own replies can be marked. */
  postAuthorId: string;
}) {
  const [sort, setSort] = useState<CommentSort>("newest");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);

  const comments = useQuery({
    queryKey: ["community-comments", postId, sort],
    queryFn: () => listComments(postId, sort),
    retry: false,
  });

  const current = SORTS.find((s) => s.key === sort)!;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:opacity-80">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            {current.label}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {SORTS.map((s) => (
              <DropdownMenuItem
                key={s.key}
                onSelect={() => setSort(s.key)}
                className={cn("text-sm", s.key === sort && "font-medium")}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-xs text-muted-foreground">
          {comments.data?.meta.total ?? 0}{" "}
          {comments.data?.meta.total === 1 ? "reply" : "replies"}
        </span>
      </div>

      <ReplyBox
        postId={postId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        sort={sort}
      />

      {comments.isLoading && (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      )}

      {comments.data?.data.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          No replies yet. Say something useful.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {comments.data?.data.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            postId={postId}
            postAuthorId={postAuthorId}
            sort={sort}
            onReply={setReplyTo}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- reply box ------------------------------- */

/**
 * The composer under the sort row.
 *
 * The send button appears only once there is something to send — an empty box
 * with a live arrow invites a tap that does nothing, and the reference hides
 * it for the same reason.
 */
function ReplyBox({
  postId,
  replyTo,
  onCancelReply,
  sort,
}: {
  postId: string;
  replyTo: CommunityComment | null;
  onCancelReply: () => void;
  sort: CommentSort;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const send = useMutation({
    mutationFn: () => addComment(postId, draft.trim(), replyTo?.id),
    onSuccess: () => {
      setDraft("");
      onCancelReply();
      void queryClient.invalidateQueries({ queryKey: ["community-comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!user) {
    return (
      <p className="py-2 text-sm text-muted-foreground">Sign in to reply.</p>
    );
  }

  const name = user.displayName?.trim() || "You";
  const ready = !!draft.trim();

  return (
    <div>
      {replyTo && (
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          Replying to{" "}
          <span className="text-foreground">{authorName(replyTo.author)}</span>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-link hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-full border border-border px-3 py-1.5">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={user.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready && !send.isPending) send.mutate();
            if (e.key === "Escape") onCancelReply();
          }}
          placeholder={
            replyTo ? `Reply to ${authorName(replyTo.author)}…` : "Add a reply…"
          }
          maxLength={5000}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {ready && (
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending}
            aria-label="Send reply"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- a reply -------------------------------- */

function CommentRow({
  comment,
  postId,
  postAuthorId,
  sort,
  onReply,
  depth = 0,
}: {
  comment: CommunityComment;
  postId: string;
  postAuthorId: string;
  sort: CommentSort;
  onReply: (comment: CommunityComment) => void;
  depth?: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteComment(postId, comment.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["community-comments", postId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const replies = comment.replies ?? [];

  return (
    <div className={cn(depth > 0 && "ml-7 border-l border-border pl-3")}>
      <div className="flex items-start gap-2.5">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={comment.author.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
            {initials(authorName(comment.author))}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
            {comment.authorIdentity?.profileUrl ? (
              <Link to={comment.authorIdentity.profileUrl} className="font-medium hover:underline">{authorName(comment.author)}</Link>
            ) : <span className="font-medium">{authorName(comment.author)}</span>}
            {/* The backend has always resolved this for replies as well as
                comments — a verified employer answering a question is exactly
                what the badge is for — and nothing rendered it until now. */}
            <IdentityLine identity={comment.authorIdentity} compact />
            <span className="text-muted-foreground">{timeAgo(comment.createdAt)}</span>
            {/* Says who wrote the post you are reading, which changes how a
                reply lands — the reference marks it for the same reason. */}
            {comment.authorId === postAuthorId && (
              <span className="text-muted-foreground">· Author</span>
            )}
          </p>

          <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.content}</p>

          <div className="mt-1 flex items-center gap-3">
            {/* Only top level: the API returns one level of nesting, so a
                reply to a reply would be stored and never shown. */}
            {depth === 0 && (
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reply
              </button>
            )}
            {user?.id === comment.authorId && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            )}
          </div>

          {/* Collapsed by default, with the count on the toggle — a long thread
              should not push the next comment off the screen. */}
          {replies.length > 0 && !showReplies && (
            <button
              type="button"
              onClick={() => setShowReplies(true)}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="flex -space-x-1.5">
                {replies.slice(0, 3).map((r) => (
                  <Avatar key={r.id} className="h-4 w-4 ring-1 ring-card">
                    <AvatarImage src={r.author.avatarUrl ?? ""} alt="" />
                    <AvatarFallback className="bg-primary/10 text-[7px] text-primary">
                      {initials(authorName(r.author))}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </span>
              Show {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {showReplies && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              postId={postId}
              postAuthorId={postAuthorId}
              sort={sort}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setShowReplies(false)}
            className="ml-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Hide replies
          </button>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default CommentThread;
