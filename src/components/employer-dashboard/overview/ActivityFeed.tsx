import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Briefcase, Clock, Loader2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPLOYER_UNDERLINE_TAB_TRIGGER } from "@/lib/tabStyles";
import { cn } from "@/lib/utils";
import FeedItem from "./FeedItem";
import SectionHeader from "./SectionHeader";
import { getMyNotifications, markNotificationRead } from "@/lib/api/notifications";

const CATEGORIES = ["All", "Applicants", "AI", "Alert", "Insight"] as const;
type Category = (typeof CATEGORIES)[number];

interface Meta {
  category: Exclude<Category, "All">;
  icon: React.ElementType;
  color: string;
}

/** Server notification `type` → how it presents in the feed. */
const TYPE_META: Record<string, Meta> = {
  application: { category: "Applicants", icon: UsersRound, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  message: { category: "Applicants", icon: MessageCircle, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  outreach: { category: "Applicants", icon: MessageCircle, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  ai_screen: { category: "AI", icon: Sparkles, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  interview: { category: "Alert", icon: Clock, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  job: { category: "Insight", icon: Briefcase, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};
const FALLBACK: Meta = { category: "Insight", icon: Bell, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Shared with the notifications page so both stay in sync from one cache entry.
const QUERY_KEY = ["employer-notifications"] as const;

const ActivityFeed = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Category>("All");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await getMyNotifications()).data,
    refetchInterval: 30_000, // keeps the "Live" badge honest
  });

  // The feed is what still needs attention: unread notifications.
  const items = useMemo(
    () =>
      (data ?? [])
        .filter((n) => n.readAt == null && !dismissed.has(n.id))
        .map((n) => {
          const meta = TYPE_META[n.type] ?? FALLBACK;
          return {
            id: n.id,
            title: n.title,
            desc: n.message,
            time: relTime(n.createdAt),
            link: n.link,
            ...meta,
          };
        }),
    [data, dismissed],
  );

  const filtered = activeTab === "All" ? items : items.filter((i) => i.category === activeTab);

  /** Dismiss = mark read on the server (persists), and hide immediately. */
  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    markNotificationRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }))
      .catch(() => undefined);
  };

  return (
    <div>
      <SectionHeader
        title="Activity & alerts"
        subtitle="Live updates to keep your pipeline moving."
        action={
          <Badge variant="secondary" className="gap-1.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </Badge>
        }
      />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
            <TabsList className="h-9 bg-transparent p-0 gap-0.5">
              {CATEGORIES.map((cat) => {
                const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className={cn(EMPLOYER_UNDERLINE_TAB_TRIGGER, "px-3 text-xs")}
                  >
                    {cat}
                    {count > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{count}</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Cap the viewport (not the root) so it scrolls once there are more items. */}
        <ScrollArea viewportClassName="max-h-[480px]">
          <ul className="divide-y divide-border">
            {isLoading ? (
              <li className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
              </li>
            ) : filtered.length === 0 ? (
              <li className="p-10 text-center text-sm text-muted-foreground">
                No {activeTab === "All" ? "activity" : activeTab.toLowerCase()} items — you're all caught up.
              </li>
            ) : (
              filtered.map((f) => (
                <FeedItem
                  key={f.id}
                  icon={f.icon}
                  title={f.title}
                  desc={f.desc}
                  category={f.category}
                  time={f.time}
                  color={f.color}
                  onDismiss={() => dismiss(f.id)}
                  onView={
                    f.link
                      ? () => {
                          dismiss(f.id);
                          navigate(f.link!);
                        }
                      : undefined
                  }
                />
              ))
            )}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ActivityFeed;
