import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CalendarClock, Clock, FileText, ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  cancelScheduledPost, getCompanyInsights, listScheduledPosts, updateScheduledPost,
  type CompanyInsights, type ScheduledPost,
} from "@/lib/api/community";
import { plainText, toDisplay, toStored, type Mention } from "@/lib/mentions";
import { MentionField } from "./MentionField";
import { ViewsChart } from "./ViewsChart";
import { defaultScheduleTime, formatWhen, localZone, scheduleProblem, toLocalInput, SCHEDULE_MAX_MS, SCHEDULE_MIN_MS } from "./schedule";

/**
 * What a company page's owners and admins see on it, and nobody else: how its
 * posts are doing, and what is scheduled to go out.
 *
 * Asks the server for the page's numbers, which answers with nothing for
 * anyone who does not run the page — so this renders nothing for readers,
 * without a separate "may I?" check that could disagree with the server.
 */
export function CompanyPageAdmin({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { user } = useAuth();
  const insights = useQuery({
    queryKey: ["company-insights", companyId, user?.id],
    queryFn: () => getCompanyInsights(companyId),
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
  const scheduled = useQuery({
    queryKey: ["scheduled-posts", companyId],
    queryFn: () => listScheduledPosts(companyId),
    enabled: !!insights.data,
    retry: false,
  });

  if (!insights.data) return null;
  const queue = scheduled.data ?? [];
  const failed = queue.filter((p) => p.status === "FAILED").length;

  return (
    <section aria-labelledby="page-admin" className="mb-5 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="page-admin" className="text-sm font-semibold">Your page</h2>
        <p className="text-xs text-muted-foreground">Only {companyName}'s owners and admins see this.</p>
      </div>
      <Tabs defaultValue="analytics">
        <TabsList className="h-9 rounded-full">
          <TabsTrigger value="analytics" className="gap-1.5 rounded-full text-xs">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-1.5 rounded-full text-xs">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Scheduled{queue.length > 0 ? ` (${queue.length})` : ""}
            {failed > 0 && <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-label={`${failed} not published`} />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-4">
          <Analytics data={insights.data} />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          {scheduled.isLoading ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading scheduled posts" />
          ) : scheduled.isError ? (
            <p className="text-sm text-destructive">{(scheduled.error as Error).message}</p>
          ) : queue.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nothing scheduled. Write a post as {companyName} and choose <span className="font-medium text-foreground">Schedule</span> instead of Post.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((item) => <QueuedPost key={item.id} item={item} />)}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Analytics({ data }: { data: CompanyInsights }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Post views, last {data.days} days</p>
        <p className="text-5xl font-semibold tabular-nums tracking-tight">{data.views.toLocaleString()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.peopleReached.toLocaleString()} different {data.peopleReached === 1 ? "person" : "people"} ·{" "}
          {data.published.toLocaleString()} {data.published === 1 ? "post" : "posts"} published
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Reactions" value={data.reactions} />
        <Tile label="Comments" value={data.comments} />
        <Tile label="Reshares" value={data.reshares} />
        <Tile label="New followers" value={data.followersGained} note={`${data.followers.toLocaleString()} in all`} />
      </dl>

      <ViewsChart daily={data.daily} caption="Views of the page's posts by day" />

      <div>
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">Most viewed in this period</h3>
        {data.topPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts were viewed in this period.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {data.topPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/community/posts/${p.id}`} className="block px-3 py-2.5 transition-colors hover:bg-muted/50">
                  <p className="line-clamp-2 text-sm">{p.preview}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {p.views.toLocaleString()} {p.views === 1 ? "view" : "views"} · {p.reactions} reactions · {p.comments} comments
                    {p.reshares > 0 ? ` · ${p.reshares} reshares` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        A view is a signed-in person having a post on screen, once a day each. Your team's own views never count.
      </p>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value.toLocaleString()}</dd>
      {note && <dd className="text-[11px] text-muted-foreground">{note}</dd>}
    </div>
  );
}

/** One post in the queue: when, by whom, what — and change, retry or cancel. */
function QueuedPost({ item }: { item: ScheduledPost }) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["scheduled-posts", item.companyId] });
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
        <span className="text-muted-foreground">· by {item.author.name}</span>
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

export default CompanyPageAdmin;
