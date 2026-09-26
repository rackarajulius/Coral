export type NotificationType =
  | "application"
  | "interview"
  | "message"
  | "mention"
  | "security"
  | "workflow";

export type NotificationPriority = "low" | "normal" | "high";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string; // ISO
  read: boolean;
  archived?: boolean;
  actor: {
    name: string;
    avatarUrl?: string;
    role?: string;
  };
  meta?: {
    candidate?: string;
    job?: string;
    interview?: string;
  };
  priority?: NotificationPriority;
  actionLabel?: string;
  /** Deep-link into the app (from the server notification). */
  link?: string;
}

const now = Date.now();
const mins = (m: number) => new Date(now - m * 60_000).toISOString();
const hrs = (h: number) => new Date(now - h * 3_600_000).toISOString();
const days = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const seedNotifications: AppNotification[] = [
  {
    id: "n1",
    type: "application",
    title: "New application from Sarah Chen",
    description: "Applied to Senior Product Designer — San Francisco, CA",
    timestamp: mins(2),
    read: false,
    priority: "high",
    actor: { name: "Sarah Chen", role: "Candidate" },
    meta: { candidate: "Sarah Chen", job: "Senior Product Designer" },
    actionLabel: "Review",
  },
  {
    id: "n2",
    type: "interview",
    title: "Interview reminder · 30 min",
    description: "Technical screen with Marcus Aldridge starts at 3:30 PM",
    timestamp: mins(8),
    read: false,
    priority: "high",
    actor: { name: "Marcus Aldridge", role: "Candidate" },
    meta: { candidate: "Marcus Aldridge", interview: "Technical Screen" },
    actionLabel: "Join call",
  },
  {
    id: "n3",
    type: "message",
    title: "New message from Priya Natarajan",
    description: "“Thanks for the update — I'm available Thursday after 2 PM.”",
    timestamp: mins(24),
    read: false,
    actor: { name: "Priya Natarajan", role: "Candidate" },
    meta: { candidate: "Priya Natarajan" },
    actionLabel: "Reply",
  },
  {
    id: "n4",
    type: "mention",
    title: "Jordan Walker mentioned you",
    description: "in the Engineering Manager pipeline — “@you can you do the final loop?”",
    timestamp: mins(46),
    read: false,
    actor: { name: "Jordan Walker", role: "Recruiter" },
    meta: { job: "Engineering Manager" },
    actionLabel: "Open thread",
  },
  {
    id: "n5",
    type: "workflow",
    title: "Offer approval required",
    description: "Offer for Elena Rossi (Staff Engineer) is awaiting your approval.",
    timestamp: hrs(2),
    read: true,
    priority: "high",
    actor: { name: "Workflow Bot", role: "System" },
    meta: { candidate: "Elena Rossi", job: "Staff Engineer" },
    actionLabel: "Approve",
  },
  {
    id: "n6",
    type: "application",
    title: "12 new applications today",
    description: "Across 4 active roles. Top match score: 94% (David Okafor).",
    timestamp: hrs(3),
    read: true,
    actor: { name: "Pipeline", role: "Summary" },
    actionLabel: "View pipeline",
  },
  {
    id: "n7",
    type: "security",
    title: "New sign-in from Berlin, DE",
    description: "Chrome on macOS · 18 May 2026, 09:12 GMT+2",
    timestamp: hrs(5),
    read: true,
    priority: "high",
    actor: { name: "Security", role: "System" },
    actionLabel: "Review device",
  },
  {
    id: "n8",
    type: "interview",
    title: "Interview feedback submitted",
    description: "Aanya Mehta submitted feedback for Lucas Bernard — strong hire.",
    timestamp: hrs(8),
    read: true,
    actor: { name: "Aanya Mehta", role: "Interviewer" },
    meta: { candidate: "Lucas Bernard", interview: "Onsite Loop" },
    actionLabel: "View scorecard",
  },
  {
    id: "n9",
    type: "message",
    title: "Candidate withdrew application",
    description: "Noah Kim withdrew from Senior Backend Engineer — accepted competing offer.",
    timestamp: days(1),
    read: true,
    actor: { name: "Noah Kim", role: "Candidate" },
    meta: { candidate: "Noah Kim", job: "Senior Backend Engineer" },
  },
  {
    id: "n10",
    type: "workflow",
    title: "Job posting expires in 3 days",
    description: "Product Marketing Manager will be auto-archived on May 21.",
    timestamp: days(1),
    read: true,
    actor: { name: "Workflow Bot", role: "System" },
    meta: { job: "Product Marketing Manager" },
    actionLabel: "Renew",
  },
  {
    id: "n11",
    type: "mention",
    title: "Team comment on scorecard",
    description: "Riley Tan: “Let's align on leveling before the debrief.”",
    timestamp: days(2),
    read: true,
    actor: { name: "Riley Tan", role: "Hiring Manager" },
    meta: { candidate: "Lucas Bernard" },
    actionLabel: "Open thread",
  },
  {
    id: "n12",
    type: "application",
    title: "New referral from Maya Patel",
    description: "Referred Daniel Reyes for Senior Data Scientist.",
    timestamp: days(3),
    read: true,
    actor: { name: "Maya Patel", role: "Employee" },
    meta: { candidate: "Daniel Reyes", job: "Senior Data Scientist" },
    actionLabel: "Review",
  },
];

export const realtimeFeed: Omit<AppNotification, "id" | "timestamp" | "read">[] = [
  {
    type: "application",
    title: "New application from Theo Lambert",
    description: "Applied to Senior Frontend Engineer — Remote (EU).",
    actor: { name: "Theo Lambert", role: "Candidate" },
    meta: { candidate: "Theo Lambert", job: "Senior Frontend Engineer" },
    actionLabel: "Review",
    priority: "normal",
  },
  {
    type: "message",
    title: "New message from Hannah Wright",
    description: "“Quick question about the take-home assignment timeline.”",
    actor: { name: "Hannah Wright", role: "Candidate" },
    meta: { candidate: "Hannah Wright" },
    actionLabel: "Reply",
  },
  {
    type: "mention",
    title: "Devon Park mentioned you",
    description: "in Staff Engineer debrief — “@you final call on leveling?”",
    actor: { name: "Devon Park", role: "Recruiter" },
    meta: { job: "Staff Engineer" },
    actionLabel: "Open thread",
  },
  {
    type: "interview",
    title: "Interview rescheduled",
    description: "Priya Natarajan moved to Thursday 4:00 PM.",
    actor: { name: "Priya Natarajan", role: "Candidate" },
    meta: { candidate: "Priya Natarajan", interview: "Hiring Manager Screen" },
    actionLabel: "View",
  },
];