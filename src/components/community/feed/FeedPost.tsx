import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark, Building2, EyeOff, Flag, Link2, Loader2,MessageCircle,MoreHorizontal,Pencil, Repeat2,
  Share2, ThumbsUp, Trash2, UserRoundCheck, UserRoundPlus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import { getCompanyById } from "@/lib/api/employerCompany";
import { ReportDialog } from "./ReportDialog";
import { PollCard } from "./PollCard";
import { PostText } from "./PostText";
import { CommentThread } from "./CommentThread";
import { IdentityLine } from "./IdentityLine";
import { ImageLightbox } from "./ImageLightbox";
import { PostSkeleton } from "./skeletons";
import { FeedVideo } from "./FeedVideo";
import { CompanyHoverCard, PersonHoverCard, SpaceHoverCard } from "./ProfileHoverCard";
import { usePersonFollow } from "./usePersonFollow";
import { TidePostCard } from "@/components/community/tides/TidePostCard";
import { CommunityLinkedCard, postPurposeLabels } from "./CommunityLinkedCard";
import {
  authorName,
  companyPath,
  personPath,
  bookmarkPost,
  deletePost,
  initials,
  isVideoUrl,
  likePost,
  postUrl,
  resharePost,
  timeAgo,
  unbookmarkPost,
  unlikePost,
  updatePost,
  type CommunityPost,
  type ResharedPost,
} from "@/lib/api/community";

const MAX_LENGTH = 5000;

/**
 * One post, with its replies.
 *
 * Comments are threaded server-side (`parentId`) and were never rendered — the
 * component this replaces kept posts in local state and logged likes to the
 * console, so nothing anyone did survived a refresh.
 */
export function FeedPost({
  post,
  onHashtag,
  defaultShowComments = false,
}: {
  post: CommunityPost;
  onHashtag?: (tag: string) => void;
  /** Open on the thread. Set when a notification sent you to this post. */
  defaultShowComments?: boolean;
}) {
  const { user } = useAuth();
  const { requireAuth } = useAuthModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(defaultShowComments);
  const avatarUrl = post.company ? null : post.author.avatarUrl;
  const [readyAvatarUrl, setReadyAvatarUrl] = useState<string | null>(null);
  const avatarReady = !avatarUrl || readyAvatarUrl === avatarUrl;

  // Mount the avatar behind the placeholder so the post and photo reveal
  // together. A slow host must not keep the post unreadable indefinitely.
  useEffect(() => {
    if (avatarReady) return;
    const timeout = window.setTimeout(() => setReadyAvatarUrl(avatarUrl), 800);
    return () => window.clearTimeout(timeout);
  }, [avatarUrl, avatarReady]);

  // Hashtags are always links: without an override they open search for
  // that tag, so one clicked in a space works the same as one in the feed.
  const openTag =
    onHashtag ?? ((tag: string) => navigate(`/community/search?q=${encodeURIComponent(`#${tag}`)}`));
  const [reporting, setReporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [resharing, setResharing] = useState(false);
  // The post's pictures, in order, for the full-size viewer. Videos have their
  // own controls and are left out.
  const images = post.mediaUrls.filter((url) => !isVideoUrl(url));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Local only: there is no hide endpoint yet, so a hidden post returns on refresh.
  const [hidden, setHidden] = useState(false);

  // The options menu closes as soon as the mouse leaves it, rather than
  // waiting for a second click. The short delay lets the cursor cross the gap
  // between the ••• button and the menu without closing it. Touch is left
  // alone: a finger has no "leave".
  const [menuOpen, setMenuOpen] = useState(false);
  const menuCloseTimer = useRef<number>();
  // Preview cards open under the header, starting at the avatar.
  const headerRef = useRef<HTMLElement>(null);
  const cancelMenuClose = () => window.clearTimeout(menuCloseTimer.current);
  const scheduleMenuClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelMenuClose();
    menuCloseTimer.current = window.setTimeout(() => setMenuOpen(false), 150);
  };
  useEffect(() => cancelMenuClose, []);

  // Optimistic, because a like that waits for a round trip feels broken. The
  // count is derived from the flag so the two never disagree on screen.
  const [liked, toggleLike] = useServerToggle(
    post.likedByMe,
    () => likePost(post.id),
    () => unlikePost(post.id),
  );
  const likes = post._count.likes - (post.likedByMe ? 1 : 0) + (liked ? 1 : 0);
  const [bookmarked, toggleBookmark] = useServerToggle(
    post.bookmarkedByMe,
    () => bookmarkPost(post.id),
    () => unbookmarkPost(post.id),
  );

  /**
   * Edited in place rather than in the composer: the post keeps its space,
   * voice and attachments, and only the words are open to change.
   */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  useEffect(() => setSavedContent(null), [post.content]);
  const content = savedContent ?? post.content;

  const edit = useMutation({
    mutationFn: () => updatePost(post.id, draft.trim()),
    onSuccess: () => {
      setSavedContent(draft.trim());
      setEditing(false);
      toast.success("Post updated");
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["community-post", post.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const draftChanged = draft.trim() !== content;
  const canSaveEdit =
    draftChanged && (!!draft.trim() || post.mediaUrls.length > 0) && !edit.isPending;

  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      toast.success("Post deleted");
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["community-post", post.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl(post.id));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const mine = user?.id === post.authorId;
  // The company page behind a company post, when it has one; its name and
  // logo preview it on hover.
  const companyProfileId = post.company?.profiles?.[0]?.id;
  const authorForCard = {
    id: post.author.id,
    name: authorName(post.author),
    avatarUrl: post.author.avatarUrl,
  };
  // The author's own card, on their avatar and their name.
  const personForCard = {
    ...authorForCard,
    role: post.author.role,
    identity: post.authorIdentity,
  };
  // Their page in the community — posts, followers, Follow — which everyone
  // who posts has. It links on to their career profile when that is public.
  const authorProfileUrl = personPath(post.author.id);
  const canManage = post.canEdit ?? (!post.company && mine);

  // A slim stand-in rather than nothing, so a mis-click can be undone in place.
  if (hidden) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-card px-5 py-3">
        <p className="text-sm text-muted-foreground">Post hidden. It will show again when you reload.</p>
        <Button variant="ghost" size="sm" onClick={() => setHidden(false)}>
          Undo
        </Button>
      </div>
    );
  }

  return (
    <>
    {!avatarReady && <PostSkeleton />}
    <article hidden={!avatarReady} className="rounded-2xl border border-border bg-card px-5 pb-2 pt-5">
      {/* The anchor every preview card in this header lines up with. */}
      <header ref={headerRef} className="flex items-start gap-3">
        {post.company ? (
          // A company post does not wear the author's face. It is the company
          // speaking, and the avatar is the first thing that says so.
          companyProfileId ? (
            <CompanyHoverCard anchorRef={headerRef} profileId={companyProfileId} name={post.company.name}>
              <Link
                to={companyPath(companyProfileId)}
                aria-label={post.company.name}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"
              >
                <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              </Link>
            </CompanyHoverCard>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
          )
        ) : (
          <PersonHoverCard anchorRef={headerRef} person={personForCard}>
            {/* A link when there is a profile to go to, so the avatar works
                like the name beside it; otherwise just the picture. */}
            {authorProfileUrl ? (
              <Link to={authorProfileUrl} aria-label={authorName(post.author)} className="shrink-0 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={avatarUrl ?? ""}
                    alt=""
                    onLoadingStatusChange={(status) => {
                      if (status === "loaded" || status === "error") setReadyAvatarUrl(avatarUrl);
                    }}
                  />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials(authorName(post.author))}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <span className="shrink-0 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={avatarUrl ?? ""}
                    alt=""
                    onLoadingStatusChange={(status) => {
                      if (status === "loaded" || status === "error") setReadyAvatarUrl(avatarUrl);
                    }}
                  />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials(authorName(post.author))}
                  </AvatarFallback>
                </Avatar>
              </span>
            )}
          </PersonHoverCard>
        )}
        <div className="min-w-0 flex-1">
          {post.company ? (
            <>
              <div className="flex items-center gap-2">
                {companyProfileId ? (
                  <CompanyHoverCard anchorRef={headerRef} profileId={companyProfileId} name={post.company.name}>
                    <Link to={companyPath(companyProfileId)} className="truncate text-sm font-medium hover:underline">{post.company.name}</Link>
                  </CompanyHoverCard>
                ) : <p className="truncate text-sm font-medium">{post.company.name}</p>}
                {/* Following needs the company's page; without one there is
                    nothing to follow. */}
                {user && !mine && post.company.profiles?.[0]?.id && (
                  <CompanyFollowButton profileId={post.company.profiles[0].id} />
                )}
              </div>
              {/* Where a person's post has their title, a company's has how
                  many follow it. */}
              {companyProfileId && <CompanyFollowerCount profileId={companyProfileId} />}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <PersonHoverCard anchorRef={headerRef} person={personForCard}>
                  {authorProfileUrl ? (
                    <Link to={authorProfileUrl} className="truncate text-sm font-medium hover:underline">
                      {authorName(post.author)}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{authorName(post.author)}</p>
                  )}
                </PersonHoverCard>
                {user && !mine && <PersonFollowButton authorId={post.authorId} />}
              </div>
              <IdentityLine identity={post.authorIdentity} />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {/* Which room this was said in, and a way into it. Absent only for
                posts written before spaces existed. */}
            {post.space && (
              <>
                <SpaceHoverCard anchorRef={headerRef} space={post.space}>
                  <Link to={`/community/spaces/${post.space.slug}`} className="text-link hover:underline">
                    {post.space.name}
                  </Link>
                </SpaceHoverCard>
                {" · "}
              </>
            )}
            {/* The timestamp is the post's own address, as it is everywhere
                else people have learned to look for one. */}
            <Link
              to={`/community/posts/${post.id}`}
              className="hover:underline"
              title={new Date(post.createdAt).toLocaleString()}
            >
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
            </Link>
            {(post.isEdited || savedContent !== null) && " · edited"}
          </p>
        </div>
        <DropdownMenu
          modal={false}
          open={menuOpen}
          onOpenChange={(open) => {
            cancelMenuClose();
            setMenuOpen(open);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-3 -mt-2 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground dark:hover:bg-foreground/10 dark:data-[state=open]:bg-foreground/10"
              aria-label="Post options"
              onPointerEnter={cancelMenuClose}
              onPointerLeave={scheduleMenuClose}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            // Always below the button, even near the bottom of the screen,
            // where Radix would otherwise flip it above.
            avoidCollisions={false}
            onPointerEnter={cancelMenuClose}
            onPointerLeave={scheduleMenuClose}
          >
            <DropdownMenuItem className="gap-2" onSelect={() => void copyLink()}>
              <Link2 className="h-4 w-4" /> Copy link
            </DropdownMenuItem>
            {user && canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    setDraft(content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-destructive"
                  onSelect={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
            {/* Reporting your own post is refused server-side — you can
                delete it — so it is not offered here either. */}
            {user && !mine && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onSelect={() => setHidden(true)}>
                  <EyeOff className="h-4 w-4" /> Hide post
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setReporting(true)}>
                  <Flag className="h-4 w-4" /> Report
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {editing ? (
        <div className="mt-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSaveEdit) edit.mutate();
            }}
            maxLength={MAX_LENGTH}
            rows={Math.min(Math.max(draft.split("\n").length, 3), 12)}
            aria-label="Edit post"
            className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-foreground/30"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-muted-foreground">Ctrl + Enter to save · Esc to cancel</span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={edit.isPending}>
              Cancel
            </Button>
            <Button size="sm" className="rounded-full px-4" onClick={() => edit.mutate()} disabled={!canSaveEdit}>
              {edit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </div>
      ) : content ? (
        <div className="mt-3">
          <PostText text={content} onHashtag={openTag} />
        </div>
      ) : null}

      {post.purpose && post.purpose !== "general" && (
        <p className="mt-2 text-xs font-medium text-muted-foreground">{postPurposeLabels[post.purpose]}</p>
      )}
      <CommunityLinkedCard record={post.linkedRecord} unavailable={post.linkedRecordUnavailable} postId={post.id} />

      {/* Shown only when there is no media of the author's own — a card about
          someone else's page should not outrank the picture they chose. */}
      {post.linkPreview && !post.linkedRecord && !post.linkedRecordUnavailable && post.mediaUrls.length === 0 && (
        <a
          href={post.linkPreview.url}
          target="_blank"
          rel="nofollow noopener noreferrer ugc"
          className="mt-3 flex overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/50"
        >
          {post.linkPreview.imageUrl && (
            <img
              src={post.linkPreview.imageUrl}
              alt=""
              loading="lazy"
              className="h-24 w-24 shrink-0 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="min-w-0 flex-1 p-3">
            {post.linkPreview.siteName && (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {post.linkPreview.siteName}
              </p>
            )}
            {post.linkPreview.title && (
              <p className="line-clamp-1 text-sm font-medium">{post.linkPreview.title}</p>
            )}
            {post.linkPreview.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {post.linkPreview.description}
              </p>
            )}
          </div>
        </a>
      )}

      {post.tideId && <TidePostCard tideId={post.tideId} />}

      {post.resharedFrom && <ResharedCard original={post.resharedFrom} />}

      {post.mediaUrls.length > 0 && (
        <div className={cn("mt-3 grid gap-2", post.mediaUrls.length > 1 && "grid-cols-2")}>
          {post.mediaUrls.map((url) =>
            isVideoUrl(url) ? (
              // Plays muted while on screen, one at a time — see FeedVideo.
              <FeedVideo key={url} src={url} />
            ) : (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIndex(images.indexOf(url))}
                aria-label="View image full size"
                className="block w-full overflow-hidden rounded-xl bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className={cn(
                    "block w-full",
                    post.mediaUrls.length === 1
                      ? // One picture is shown whole — a diagram or a screenshot
                        // cropped at the edges loses the part that mattered.
                        // Very tall ones stop at 600px and fit inside it, with
                        // the muted background either side.
                        "h-auto max-h-[37.5rem] object-contain"
                      : // Several are tiles, cropped to one shape so the grid
                        // lines up; the full picture is a click away.
                        "aspect-square object-cover",
                  )}
                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                />
              </button>
            ),
          )}
        </div>
      )}

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      {post.poll && <PollCard poll={post.poll} />}

      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {/* The stored tags, which include any the server parsed out of the
              body. Same colour and same behaviour as the inline ones. */}
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => openTag(tag)}
              className="text-xs text-link hover:underline"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(actionPill, liked && "border-coral/40 text-coral")}
            onClick={() => requireAuth(toggleLike)}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <ThumbsUp className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
            <span className="tabular-nums">{likes.toLocaleString()}</span>
          </button>

          <button
            type="button"
            className={cn(actionPill, showComments && "border-foreground/30 text-foreground")}
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            aria-label={showComments ? "Hide comments" : "Show comments"}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{post._count.comments.toLocaleString()}</span>
          </button>

          {/* Two ways to pass a post on, so the button asks which rather
              than reposting on a single, unconfirmed tap. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={actionPill} aria-label="Share">
                <Share2 className="h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">{post._count.reshares.toLocaleString()}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="gap-2" onSelect={() => requireAuth(() => setResharing(true))}>
                <Repeat2 className="h-4 w-4" /> Reshare
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => void copyLink()}>
                <Link2 className="h-4 w-4" /> Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          className={cn(actionPill, "w-8 justify-center px-0", bookmarked && "border-coral/40 text-coral")}
          onClick={() => requireAuth(toggleBookmark)}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove from saved" : "Save"}
          title={bookmarked ? "Remove from saved" : "Save"}
        >
          <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} aria-hidden="true" />
        </button>
      </footer>

      {showComments && (
        <CommentThread postId={post.id} postAuthorId={post.authorId} />
      )}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        target={{ kind: "post", id: post.id }}
      />

      <ReshareDialog
        open={resharing}
        onClose={() => setResharing(false)}
        post={post}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the feed along with its comments. This can't be undone.
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
    </article>
    </>
  );
}

/**
 * A flag the server owns, toggled optimistically.
 *
 * Clicks update the screen at once; requests go out one at a time until the
 * server agrees with the last thing the reader chose. Firing one request per
 * click lets a like and an unlike race, and whichever lands last wins — which
 * is not always the one the reader meant.
 */
function useServerToggle(
  serverValue: boolean,
  turnOn: () => Promise<unknown>,
  turnOff: () => Promise<unknown>,
) {
  const [value, setValue] = useState(serverValue);
  const desired = useRef(serverValue);
  const confirmed = useRef(serverValue);
  const syncing = useRef(false);

  // A refetch brings the server's word; take it unless a change is in flight.
  useEffect(() => {
    if (syncing.current) return;
    desired.current = confirmed.current = serverValue;
    setValue(serverValue);
  }, [serverValue]);

  const toggle = async () => {
    desired.current = !desired.current;
    setValue(desired.current);
    if (syncing.current) return;
    syncing.current = true;
    try {
      while (desired.current !== confirmed.current) {
        const target = desired.current;
        await (target ? turnOn() : turnOff());
        confirmed.current = target;
      }
    } catch (e) {
      // Put it back. Showing a state that did not persist is worse than none.
      desired.current = confirmed.current;
      setValue(confirmed.current);
      toast.error((e as Error).message);
    } finally {
      syncing.current = false;
    }
  };

  return [value, () => void toggle()] as const;
}

/**
 * Passing a post on, with room for a few words of your own.
 *
 * A confirmation as much as a composer: a reshare is a post under your name,
 * and it should not happen because a thumb brushed the wrong icon.
 */
function ReshareDialog({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: CommunityPost;
}) {
  const queryClient = useQueryClient();
  const [thoughts, setThoughts] = useState("");
  // A reshare of a reshare passes on whatever was originally written.
  const original = post.resharedFrom ?? post;

  const reshare = useMutation({
    mutationFn: () => resharePost(post.id, thoughts.trim() || undefined),
    onSuccess: () => {
      toast.success("Reshared");
      setThoughts("");
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !reshare.isPending && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reshare post</DialogTitle>
          <DialogDescription>It will appear as a new post from you, with the original attached.</DialogDescription>
        </DialogHeader>

        <textarea
          autoFocus
          value={thoughts}
          onChange={(e) => setThoughts(e.target.value)}
          placeholder="Add your thoughts (optional)"
          maxLength={MAX_LENGTH}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-foreground/30"
        />

        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium">
            {original.company ? original.company.name : authorName(original.author)}
          </p>
          {original.content && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-muted-foreground">{original.content}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={reshare.isPending}>Cancel</Button>
          <Button onClick={() => reshare.mutate()} disabled={reshare.isPending}>
            {reshare.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Reshare
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The post being passed on, shown inside the one passing it.
 *
 * Quiet on purpose: the resharer's words come first, and this is the thing
 * they are pointing at. A moderator-removed original says so rather than
 * rendering an empty box — the reshare is still someone's post, and deleting
 * it because of what it quoted is not ours to do.
 */
function ResharedCard({ original }: { original: ResharedPost }) {
  if (original.removedAt) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground">This post is no longer available.</p>
      </div>
    );
  }

  const name = original.company ? original.company.name : authorName(original.author);

  return (
    <div className="mt-3 rounded-xl border border-border p-4">
      <Link to={`/community/posts/${original.id}`} className="block transition-colors hover:text-primary">
      <div className="flex items-center gap-2">
        {original.company ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-3 w-3 text-primary" aria-hidden="true" />
          </span>
        ) : (
          <Avatar className="h-6 w-6">
            <AvatarImage src={original.author.avatarUrl ?? ""} alt="" />
            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
              {initials(authorName(original.author))}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="text-xs font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(original.createdAt)}</span>
      </div>

      {original.content && (
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-muted-foreground">
          {original.content}
        </p>
      )}

      {original.mediaUrls.length > 0 && !isVideoUrl(original.mediaUrls[0]) && (
        // Whole, like a picture in the feed itself: a diagram cropped to a
        // strip is no longer the thing that was shared. Tall ones stop at
        // 600px and fit inside it, on the muted background.
        <div className="mt-2 overflow-hidden rounded-lg bg-muted/40">
          <img
            src={original.mediaUrls[0]}
            alt=""
            loading="lazy"
            className="block h-auto max-h-[37.5rem] w-full object-contain"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
          />
        </div>
      )}
      </Link>
      <CommunityLinkedCard record={original.linkedRecord} unavailable={original.linkedRecordUnavailable} postId={original.id} />
    </div>
  );
}

/**
 * Follow / Following for a company post — real, through the company follow
 * endpoint. Keyed by company, so every post from it shows the same state.
 */
/**
 * "1,234 followers" under a company's name.
 *
 * The public company record gives the count to everyone; signed in, the
 * follow status takes over, so following from this post or its card moves
 * the number at once. Both are cached per company, shared with the company's
 * hover card, so a feed full of its posts asks once.
 */
function CompanyFollowerCount({ profileId }: { profileId: string }) {
  const company = useQuery({
    queryKey: ["company-profile", profileId],
    queryFn: () => getCompanyById(profileId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { followerCount } = useFollowCompany({
    companyId: profileId,
    initialFollowerCount: company.data?.followerCount ?? 0,
  });
  // Nothing until there is a real number: a "0 followers" that becomes 1,234
  // a moment later reads as a glitch.
  if (!company.data) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {followerCount.toLocaleString()} {followerCount === 1 ? "follower" : "followers"}
    </p>
  );
}

function CompanyFollowButton({ profileId }: { profileId: string }) {
  const { isFollowing, isPending, toggle } = useFollowCompany({ companyId: profileId });
  return <FollowPill following={isFollowing} disabled={isPending} onClick={toggle} />;
}

/**
 * Follow / Following beside a person's name — a real follow, saved and
 * counted. Shares its cache entry with the person's hover card, so every
 * Follow for the same person, on any of their posts, moves together.
 */
function PersonFollowButton({ authorId }: { authorId: string }) {
  const { isFollowing, isPending, toggle } = usePersonFollow(authorId);
  return <FollowPill following={isFollowing} disabled={isPending} onClick={toggle} />;
}

function FollowPill({
  following,
  disabled,
  onClick,
}: {
  following: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = following ? UserRoundCheck : UserRoundPlus;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={following}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        following
          ? "text-muted-foreground hover:text-foreground"
          : "text-coral hover:bg-coral hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {following ? "Following" : "Follow"}
    </button>
  );
}

/** The footer's rounded, outlined actions: icon, then count. */
const actionPill =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export default FeedPost;
