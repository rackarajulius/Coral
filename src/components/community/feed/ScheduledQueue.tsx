import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, FileText, ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import {
  cancelScheduledPost, listMyScheduledPosts, updateScheduledPost, MY_SCHEDULED_POSTS_KEY, type ScheduledPost,
} from "@/lib/api/community";
import { plainText, toDisplay, toStored, type Mention } from "@/lib/mentions";
import { MentionField } from "./MentionField";
import { defaultScheduleTime, formatWhen, localZone, scheduleProblem, toLocalInput, SCHEDULE_MAX_MS, SCHEDULE_MIN_MS } from "./schedule";

/*
 * A scheduled post as a queue shows it — a company page's, or your own — with
 * the same controls in both: change the time, retry, edit the words, cancel.
 */

/** One post in the queue: when, by whom, what — and change, retry or cancel. */
export function QueuedPost({ item, showAuthor = true }: { item: ScheduledPost; showAuthor?: boolean }) {
  const queryClient = useQueryClient();
  // Every queue it could be in: the page's, and its writer's own.
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
  const [timeOpen, setTimeOpen] = useState(false);
  const [at, setAt] = useState(() => (item.status === "FAILED" ? defaultScheduleTime() : toLocalInput(new Date(item.publishAt))));
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reschedule = useMutation({
    mutationFn: () => updateScheduledPost(item.id, { publishAt: new Date(at).toISOString() }),
    onSuccess: (updated) => {
      toast.success(`Scheduled for ${formatWhen(updated.publishAt)}`);
      setTimeOpen(false);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const cancel = useMutation({
    mutationFn: () => cancelScheduledPost(item.id),
    onSuccess: () => {
      toast.success("Scheduled post cancelled");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const words = plainText(item.content).trim();
  const failed = item.status === "FAILED";
  const publishing = item.status === "PUBLISHING";

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={failed ? "font-medium text-destructive" : "font-medium"}>
          {failed ? "Not published" : publishing ? "Publishing now" : formatWhen(item.publishAt)}
        </span>
        {showAuthor && <span className="text-muted-foreground">· by {item.author.name}</span>}
      </div>
      {words && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{words}</p>}
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {item.document && (
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {item.document.title}{item.document.pages ? ` · ${item.document.pages} pages` : ""}
          </span>
        )}
        {item.mediaUrls.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {item.mediaUrls.length} {item.mediaUrls.length === 1 ? "attachment" : "attachments"}
          </span>
        )}
        {item.poll && <span>Poll · {item.poll.options.length} choices</span>}
      </div>
      {failed && item.failureReason && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {item.failureReason}
        </p>
      )}

      {!publishing && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Popover open={timeOpen} onOpenChange={setTimeOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1 rounded-full px-2.5 text-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {failed ? "Try again" : "Change time"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-2 rounded-xl p-4">
              <label htmlFor={`time-${item.id}`} className="text-sm font-medium">Publish on</label>
              <input
                id={`time-${item.id}`}
                type="datetime-local"
                value={at}
                min={toLocalInput(new Date(Date.now() + SCHEDULE_MIN_MS))}
                max={toLocalInput(new Date(Date.now() + SCHEDULE_MAX_MS))}
                onChange={(e) => setAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-foreground/30"
              />
              <p className="text-[11px] text-muted-foreground">{scheduleProblem(at) ?? localZone()}</p>
              <Button
                size="sm"
                className="w-full rounded-full"
                onClick={() => reschedule.mutate()}
                disabled={!!scheduleProblem(at) || reschedule.isPending}
              >
                {reschedule.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Save time
              </Button>
            </PopoverContent>
          </Popover>
          {!failed && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-full px-2.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit words
            </Button>
          )}
          {confirming ? (
            <>
              <span className="text-xs text-muted-foreground">Cancel this post?</span>
              <Button size="sm" variant="destructive" className="h-7 rounded-full px-2.5 text-xs" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Yes, cancel it
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
            </Button>
          )}
        </div>
      )}

      {editing && <EditWords item={item} onClose={() => setEditing(false)} onSaved={refresh} />}
    </li>
  );
}

/** The words of a scheduled post, with the same "@" menu as the composer. */
function EditWords({ item, onClose, onSaved }: { item: ScheduledPost; onClose: () => void; onSaved: () => void }) {
  const [initial] = useState(() => toDisplay(item.content));
  const [draft, setDraft] = useState(initial.text);
  const [mentions, setMentions] = useState<Mention[]>(initial.mentions);
  const save = useMutation({
    mutationFn: () => updateScheduledPost(item.id, { content: toStored(draft.trim(), mentions) }),
    onSuccess: () => {
      toast.success("Scheduled post updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const empty = !draft.trim() && !item.document && item.mediaUrls.length === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit scheduled post</DialogTitle>
          <DialogDescription>Goes out {formatWhen(item.publishAt)}. Pictures and documents stay as they are.</DialogDescription>
        </DialogHeader>
        <MentionField
          multiline
          autoFocus
          value={draft}
          onValueChange={setDraft}
          onMention={(m) => setMentions((all) => [...all, m])}
          maxLength={5000}
          rows={6}
          aria-label="Scheduled post text"
          className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-foreground/30"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={empty || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Your own queue: posts in your name waiting for their time, or that could
 * not go out. Shared by the nav's "Scheduled" row and the dialog it opens, so
 * both read one cached list.
 */
export function useMyScheduledPosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: MY_SCHEDULED_POSTS_KEY(user?.id),
    queryFn: listMyScheduledPosts,
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
}

/** Your scheduled posts, in a dialog — opened from the nav, or from a notification. */
export function MyScheduledPostsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queue = useMyScheduledPosts();
  const items = queue.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Your scheduled posts</DialogTitle>
          <DialogDescription>
            They go out under your name at the time shown. Only you can see them until then.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {queue.isLoading ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading scheduled posts" />
          ) : queue.isError ? (
            <p className="text-sm text-destructive">{(queue.error as Error).message}</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nothing scheduled. Write a post and choose <span className="font-medium text-foreground">Schedule</span> instead of Post.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => <QueuedPost key={item.id} item={item} showAuthor={false} />)}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
