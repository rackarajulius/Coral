import {
  Briefcase,
  Calendar,
  MessageSquare,
  AtSign,
  ShieldAlert,
  GitBranch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@/data/employer/notifications/notifications-data";

export const TYPE_META: Record<
  NotificationType,
  { label: string; icon: LucideIcon; tint: string }
> = {
  application: { label: "Application", icon: Briefcase, tint: "text-orange bg-orange/10" },
  interview: { label: "Interview", icon: Calendar, tint: "text-primary bg-primary/10" },
  message: { label: "Message", icon: MessageSquare, tint: "text-success bg-success/10" },
  mention: { label: "Mention", icon: AtSign, tint: "text-warning bg-warning/10" },
  security: { label: "Security", icon: ShieldAlert, tint: "text-destructive bg-destructive/10" },
  workflow: { label: "Workflow", icon: GitBranch, tint: "text-muted-foreground bg-secondary" },
};
