import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarClock, Loader2, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { getCompanyInsights, getCompanyVoice, listScheduledPosts, type CompanyInsights } from "@/lib/api/community";
import { PostComposer } from "./PostComposer";
import { ViewsChart } from "./ViewsChart";
import { QueuedPost } from "./ScheduledQueue";

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
  // The composer posts as the one company you speak for; offered here only
  // when that is this page, so it never opens in another company's name.
  const companyVoice = useQuery({
    queryKey: ["community-company-voice", user?.id],
    queryFn: getCompanyVoice,
    enabled: !!insights.data,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const canPostHere = companyVoice.data?.id === companyId;
  const [composing, setComposing] = useState(false);

  if (!insights.data) return null;
  const queue = scheduled.data ?? [];
  const failed = queue.filter((p) => p.status === "FAILED").length;

  return (
    <section aria-labelledby="page-admin" className="mb-5 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="page-admin" className="text-sm font-semibold">Your page</h2>
          <p className="text-xs text-muted-foreground">Only {companyName}'s owners and admins see this.</p>
        </div>
        {canPostHere && (
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setComposing(true)}>
            <PenSquare className="h-3.5 w-3.5" aria-hidden="true" /> Post as {companyName}
          </Button>
        )}
      </div>
      {canPostHere && (
        <PostComposer spaceId={null} open={composing} onOpenChange={setComposing} showPrompt={false} startAsCompany />
      )}
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

export default CompanyPageAdmin;
