import {
  UsersRound,
  Sparkles,
  Bot,
  Building2,
  Megaphone,
  Lightbulb,
  Zap,
  RefreshCcw,
  Clock,
  MessageCircle,
  Crown,
} from "lucide-react";
import qaAi from "@/assets/qa-ai.jpg";
import qaProfile from "@/assets/qa-profile.jpg";
import qaSponsor from "@/assets/qa-sponsor.jpg";

export const employer = { companyName: "Acme Inc.", user: "John" };

export const quickActions = [
  {
    icon: Bot,
    title: "AI Hiring Assistant",
    desc: "Auto-screen candidates, draft outreach, and rank fit in seconds.",
    cta: "Open AI",
    badge: "New",
    img: qaAi,
    to: "/employer/hiring",
  },
  {
    icon: Building2,
    title: "Enhance Company Profile",
    desc: "Boost trust with brand assets, culture, and employee stories.",
    cta: "Improve profile",
    img: qaProfile,
    to: "/employer/profile",
  },
  {
    icon: Megaphone,
    title: "Sponsor a Job",
    desc: "3x reach, faster fills. Promote roles to top-tier talent.",
    cta: "See plans",
    badge: "Popular",
    img: qaSponsor,
    to: "/employer/pricing",
  },
];

export const feed = [
  {
    title: "2 candidates matched your role",
    desc: "Senior Frontend Engineer · 96% & 91% AI fit score",
    category: "Applicants",
    time: "2m ago",
    icon: UsersRound,
    color: "bg-indigo-500/10 text-indigo-600",
  },
  {
    title: "AI suggested 3 description improvements",
    desc: "Product Designer post may attract 27% more applicants.",
    category: "AI",
    time: "18m ago",
    icon: Sparkles,
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    title: "Branding insight: company page views up 34%",
    desc: "Most traffic from LinkedIn referrals this week.",
    category: "Insight",
    time: "1h ago",
    icon: Lightbulb,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    title: "High-intent applicants active right now",
    desc: "8 candidates viewing your roles in the last 10 minutes.",
    category: "Alert",
    time: "Just now",
    icon: Zap,
    color: "bg-rose-500/10 text-rose-600",
  },
  {
    title: "Interview reminder: Sarah Lin at 2:30pm",
    desc: "Senior Product Designer · Final round",
    category: "Alert",
    time: "3h ago",
    icon: Clock,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    title: "New message from Marcus Chen",
    desc: "Thanks for the offer letter — quick question about start date.",
    category: "Applicants",
    time: "5h ago",
    icon: MessageCircle,
    color: "bg-blue-500/10 text-blue-600",
  },
];

export const nextActions = [
  {
    icon: RefreshCcw,
    title: "Refresh a stale job",
    desc: "Backend Engineer hasn't been updated in 7 days.",
    cta: "Refresh now",
    to: "/employer/jobs",
  },
  {
    icon: Zap,
    title: "Speed up responses",
    desc: "Average reply time is 14h. Aim for under 6h to win top talent.",
    cta: "Set auto-replies",
    to: "/employer/notifications",
  },
  {
    icon: Crown,
    title: "Unlock Premium reach",
    desc: "Sponsored jobs fill 2.4× faster on average.",
    cta: "Upgrade",
    to: "/employer/pricing",
    highlight: true,
  },
];
