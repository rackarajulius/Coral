import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ImagePlus, Loader2, MessagesSquare, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PostComposer } from "./PostComposer";
import { FeedPost } from "./FeedPost";
import {
  getSpace, joinSpace, leaveSpace, listPosts, setSpaceBanner, uploadPostMedia,
  type SpaceDetail,
} from "@/lib/api/community";

/**
 * A space, rendered inside the community layout rather than on a page of its
 * own.
 *
 * It still has its own URL — that was the point of spaces — but opening one
 * swaps the middle column instead of replacing the screen, so the sidebar
 * stays put and there is nothing to press "back" from.
 */
export function SpaceView({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);

  const space = useQuery({
    queryKey: ["space", slug],
    queryFn: () => getSpace(slug),
    retry: false,
  });

  const posts = useQuery({
    queryKey: ["community-posts", "space", space.data?.id, page],
    queryFn: () => listPosts({ spaceId: space.data!.id, page }),
    enabled: !!space.data?.id,
    retry: false,
  });

  return (
    <>
      {space.isLoading && <Skeleton className="h-52 rounded-2xl" />}

      {space.isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Space not found</p>
            <p className="mt-1 text-sm text-destructive/90">
              It may have been retired for having no activity.
            </p>
          </div>
        </div>
      )}

      {space.data && (
        <>
          <SpaceHeader space={space.data} slug={slug} />

          <div className="my-5">
            <PostComposer spaceId={space.data.id} spaceName={space.data.name} />
          </div>

          {posts.isLoading && (
            <div className="space-y-4">
              {[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
          )}

          {posts.data?.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <MessagesSquare
                className="mx-auto h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium">No discussions yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {/* Named, because a space that stays empty for two weeks is
                    retired — better said here than discovered later. */}
                The first post sets what this space is for. One with nothing in it after two
                weeks is retired automatically.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {posts.data?.data.map((post) => <FeedPost key={post.id} post={post} />)}
          </div>

          {posts.data && posts.data.meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || posts.isFetching}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {posts.data.meta.page} of {posts.data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= posts.data.meta.totalPages || posts.isFetching}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* --------------------------------- header --------------------------------- */

function SpaceHeader({ space, slug }: { space: SpaceDetail; slug: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["space", slug] });
    void queryClient.invalidateQueries({ queryKey: ["community-spaces"] });
  };

  const toggle = useMutation({
    mutationFn: (join: boolean) => (join ? joinSpace(space.id) : leaveSpace(space.id)),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * The banner goes through the normal media upload, so it is byte-checked and
   * stored in our bucket — a URL field would have let a moderator point the
   * header at somebody else's server.
   */
  const pickBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadPostMedia(file);
      await setSpaceBanner(space.id, uploaded.url);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const canEdit = space.myRole === "MODERATOR";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-32 bg-gradient-to-br from-primary/15 to-accent/15">
        {space.bannerUrl && (
      <img
        src={space.bannerUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
        )}

        {canEdit && (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void pickBanner(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-background/85 px-2.5 py-1.5 text-xs backdrop-blur hover:bg-background"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {space.bannerUrl ? "Change banner" : "Add banner"}
        </button>
      </>
        )}
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight">{space.name}</h1>
        {space.description && (
          <p className="mt-1 text-sm text-muted-foreground">{space.description}</p>
        )}
      </div>

      {user && (
        <Button
          size="sm"
          variant={space.joined ? "outline" : "default"}
          onClick={() => toggle.mutate(!space.joined)}
          disabled={toggle.isPending}
        >
          {toggle.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {space.joined ? "Leave" : "Join"}
        </Button>
      )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {space.memberCount} {space.memberCount === 1 ? "member" : "members"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
        {space.postCount} {space.postCount === 1 ? "discussion" : "discussions"}
      </span>
      <span>
        Since{" "}
        {new Date(space.createdAt).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })}
      </span>
        </div>

        {space.moderators.length > 0 && (
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Moderated by</span>
        <div className="flex items-center gap-2">
          {space.moderators.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={m.avatarUrl ?? ""} alt="" />
                <AvatarFallback className="bg-primary/10 text-[8px] text-primary">
                  {m.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{m.name}</span>
            </span>
          ))}
        </div>
      </div>
        )}

        {/* Only where it is both allowed and meaningful — the server decides,
        because only it knows the member count. */}
        {space.anonymityAvailable && (
      <p className={cn("mt-3 text-xs text-muted-foreground")}>
        This space is large enough to post without your name attached.
      </p>
        )}
      </div>
    </div>
  );
}

export default SpaceView;
