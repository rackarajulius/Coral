import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowUpDown, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IdentityLine } from "./IdentityLine";
import { CommentListSkeleton } from "./skeletons";
import { ReportDialog } from "./ReportDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  addComment, authorName, deleteComment, initials, listComments, personPath, timeAgo,
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Paged by the server (twenty at a time); "Show more" asks for the next
  // page rather than leaving everything past the first twenty unreachable.
  const comments = useInfiniteQuery({
    queryKey: ["community-comments", postId, sort],
    queryFn: ({ pageParam }) => listComments(postId, sort, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    retry: false,
  });

  // A comment written while paging can shift one across a page boundary.
  const seen = new Set<string>();
  const list = (comments.data?.pages.flatMap((p) => p.data) ?? []).filter((c) =>
    seen.has(c.id) ? false : (seen.add(c.id), true),
  );
  const total = comments.data?.pages[0]?.meta.total ?? 0;

  const current = SORTS.find((s) => s.key === sort)!;

  const startReply = (comment: CommunityComment) => {
    setReplyTo(comment);
    // The click that says "reply" should land the cursor where the reply goes.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <DropdownMenu modal={false}>
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
          {total} {total === 1 ? "comment" : "comments"}
        </span>
      </div>

      <ReplyBox
        postId={postId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        inputRef={inputRef}
      />

      {comments.isLoading && <CommentListSkeleton />}

      {comments.isError && (
        <p className="py-4 text-sm text-destructive">
          Couldn't load comments.{" "}
          <button type="button" onClick={() => void comments.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {comments.isSuccess && list.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {list.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            postId={postId}
            postAuthorId={postAuthorId}
            onReply={startReply}
          />
        ))}
      </div>

      {comments.hasNextPage && (
        <button
          type="button"
          onClick={() => void comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {comments.isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Show more comments
        </button>
      )}
      <div className="h-2" />
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
  inputRef,
}: {
  postId: string;
  replyTo: CommunityComment | null;
  onCancelReply: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const send = useMutation({
    mutationFn: () => addComment(postId, draft.trim(), replyTo?.id),
    onSuccess: () => {
      setDraft("");
      onCancelReply();
      void queryClient.invalidateQueries({ queryKey: ["community-comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["community-post", postId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!user) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => openAuth()} className="text-link hover:underline">
          Sign in
        </button>{" "}
        to join the conversation.
      </p>
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

      <div className="flex items-center gap-2.5 rounded-full border border-border px-3 py-1.5 focus-within:border-foreground/30">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={user.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: Enter that confirms an IME candidate is not a send.
            if (e.key === "Enter" && !e.nativeEvent.isComposing && ready && !send.isPending) send.mutate();
            if (e.key === "Escape") onCancelReply();
          }}
          placeholder={
            replyTo ? `Reply to ${authorName(replyTo.author)}…` : "Add a comment…"
          }
          aria-label={replyTo ? `Reply to ${authorName(replyTo.author)}` : "Add a comment"}
          maxLength={5000}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {ready && (
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending}
            aria-label="Send"
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
  onReply,
  depth = 0,
}: {
  comment: CommunityComment;
  postId: string;
  postAuthorId: string;
  onReply: (comment: CommunityComment) => void;
  depth?: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reporting, setReporting] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteComment(postId, comment.id),
    onSuccess: () => {
      toast.success("Comment deleted");
      void queryClient.invalidateQueries({ queryKey: ["community-comments", postId] });
      // The count on the post's comment button moves with it.
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["community-post", postId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const replies = comment.replies ?? [];
  const mine = user?.id === comment.authorId;

  // A reply you just wrote should be visible without hunting for the toggle.
  const replyCount = replies.length;
  const previousCount = useRef(replyCount);
  useEffect(() => {
    if (replyCount > previousCount.current) setShowReplies(true);
    previousCount.current = replyCount;
  }, [replyCount]);

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
            {/* Everyone who replies has a community page, so the name always
                goes there; it links on to a public career profile. */}
            <Link to={personPath(comment.author.id)} className="font-medium hover:underline">{authorName(comment.author)}</Link>
            {/* The backend has always resolved this for replies as well as
                comments — a verified employer answering a question is exactly
                what the badge is for — and nothing rendered it until now. */}
            <IdentityLine identity={comment.authorIdentity} compact />
            <time
              dateTime={comment.createdAt}
              title={new Date(comment.createdAt).toLocaleString()}
              className="text-muted-foreground"
            >
              {timeAgo(comment.createdAt)}
            </time>
            {/* Says who wrote the post you are reading, which changes how a
                reply lands — the reference marks it for the same reason. */}
            {comment.authorId === postAuthorId && (
              <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">Author</span>
            )}
          </p>

          <p className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm">{comment.content}</p>

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
            {mine && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={remove.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </button>
            )}
            {user && !mine && (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Report
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

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              {replies.length > 0
                ? "Its replies will be removed with it. This can't be undone."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        target={{ kind: "comment", id: comment.id }}
      />
    </div>
  );
}

export default CommentThread;
