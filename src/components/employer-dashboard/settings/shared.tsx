import {
  Building2, Lock, Bell, FileClock, MailPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "general"
  | "security"
  | "notifications"
  | "templates"
  | "audit";

export const SETTINGS_TABS: { id: SettingsTabId; label: string; path: string; icon: typeof Building2 }[] = [
  { id: "general", label: "General", path: "general", icon: Building2 },
  { id: "security", label: "Security", path: "security", icon: Lock },

  { id: "notifications", label: "Notifications", path: "notifications", icon: Bell },
  { id: "templates", label: "Candidate Emails", path: "templates", icon: MailPlus },
  { id: "audit", label: "Audit Logs", path: "audit", icon: FileClock },
];

export function SectionCard({
  title, description, children, action,
}: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-card p-6 md:p-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
