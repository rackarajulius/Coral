import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  Briefcase,
  CalendarClock,
  CheckCheck,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/lib/api/notifications";

type Tab = "all" | "unread";

/** Server notification `type` → how it presents in the list. */
const TYPE_META: Record<string, { icon: React.ElementType; tint: string; label: string }> = {
  application: { icon: Briefcase, tint: "bg-coral/10 text-coral", label: "Application" },
  interview: { icon: CalendarClock, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "Interview" },
  ai_screen: { icon: Sparkles, tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400", label: "Screening" },
  message: { icon: MessageCircle, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Message" },
  outreach: { icon: MessageCircle, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Outreach" },
  job_alert: { icon: BellRing, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Job alert" },
  job_recommendation: { icon: Sparkles, tint: "bg-coral/10 text-coral", label: "Picked for you" },
};
const FALLBACK = { icon: Bell, tint: "bg-muted text-muted-foreground", label: "Update" };

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

const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<Tab>("all");

  const visible = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => !n.readAt) : notifications),
    [notifications, tab],
  );

  const open = (n: AppNotification) => {
    if (!n.readAt) void markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 pt-24">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 mb-4">
          {(["all", "unread"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-all",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                {tab === "unread" ? "Nothing unread" : "No notifications yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Updates about your applications, interviews and messages land here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n) => {
                const meta = TYPE_META[n.type] ?? FALLBACK;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn(
                        "w-full flex items-start gap-4 p-5 text-left transition-colors hover:bg-muted",
                        !n.readAt && "bg-coral/5",
                      )}
                    >
                      <span
                        className={cn(
                          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                          meta.tint,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{n.title}</span>
                          {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}
                        </span>
                        <span className="block text-sm text-muted-foreground mt-1">{n.message}</span>
                        <span className="block text-xs text-muted-foreground/70 mt-1.5">
                          {meta.label} · {relTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
