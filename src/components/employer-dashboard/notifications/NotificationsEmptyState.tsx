import { Inbox, BellRing } from "lucide-react";
import type { NotificationTab } from "./types";

const COPY: Record<NotificationTab, { title: string; desc: string }> = {
  all: {
    title: "Nothing yet",
    desc: "When new activity comes in, you'll see it here.",
  },
  unread: {
    title: "Inbox zero",
    desc: "You're all caught up. Nice work.",
  },
  mentions: {
    title: "No mentions",
    desc: "Teammates haven't mentioned you in any threads.",
  },
  archived: {
    title: "Nothing archived",
    desc: "Archived notifications will live here.",
  },
};

interface NotificationsEmptyStateProps {
  tab: NotificationTab;
}

export function NotificationsEmptyState({ tab }: NotificationsEmptyStateProps) {
  const c = COPY[tab];
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        {tab === "unread" ? (
          <BellRing className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Inbox className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{c.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{c.desc}</p>
    </div>
  );
}
