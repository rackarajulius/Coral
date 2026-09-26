import { Building2, Flag, Briefcase, UserPlus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  recentActivity?: Array<{
    type: string;
    detail: string;
    timestamp: string;
    category: string;
  }>;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'user_signup':
      return UserPlus;
    case 'job_posted':
      return Briefcase;
    case 'application':
      return Building2;
    default:
      return Flag;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'user_signup':
      return "text-success";
    case 'job_posted':
      return "text-accent";
    case 'application':
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
};

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInMs = now.getTime() - activityTime.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
};

const getActivityText = (type: string) => {
  switch (type) {
    case 'user_signup':
      return 'New user registered';
    case 'job_posted':
      return 'Job posted';
    case 'application':
      return 'New application';
    default:
      return 'Activity';
  }
};

export function ActivityFeed({ recentActivity = [] }: ActivityFeedProps) {
  // Real activity only — no fabricated fallback rows.
  const activities = recentActivity.map((activity) => ({
    icon: getActivityIcon(activity.type),
    text: getActivityText(activity.type),
    detail: activity.detail,
    time: formatTimeAgo(activity.timestamp),
    color: getActivityColor(activity.type),
  }));

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-card-foreground">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No recent activity yet</p>
        </div>
      ) : (
      <div className="divide-y divide-gray-300">
        {activities.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-coral/10 cursor-pointer"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary",
                item.color
              )}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground">{item.text}</p>
              <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
