import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SectionCard, Field } from "./shared";

/* ═════════════════════════ 7. NOTIFICATIONS ═════════════════════════ */
type Channel = "email" | "push" | "sms";
type NotifKey = "applications" | "interviews" | "mentions" | "security" | "digest";

const NOTIF_TYPES: { key: NotifKey; l: string; d: string }[] = [
  { key: "applications", l: "New applications", d: "When a candidate applies to one of your jobs" },
  { key: "interviews",   l: "Interview reminders", d: "Notifications before scheduled interviews" },
  { key: "mentions",     l: "Team mentions", d: "When someone @mentions you in a comment" },
  { key: "security",     l: "Security alerts", d: "Critical sign-in and account events" },
  { key: "digest",       l: "Weekly digest", d: "Summary of activity each Monday" },
];

type NotifState = Record<NotifKey, Record<Channel, boolean>>;

const DEFAULT_NOTIFS: NotifState = {
  applications: { email: true,  push: true,  sms: false },
  interviews:   { email: true,  push: true,  sms: false },
  mentions:     { email: true,  push: true,  sms: false },
  security:     { email: true,  push: false, sms: true  },
  digest:       { email: true,  push: false, sms: false },
};

export default function Notifications() {
  const [notifs, setNotifs] = useState<NotifState>(DEFAULT_NOTIFS);
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietFrom, setQuietFrom] = useState("20:00");
  const [quietTo, setQuietTo] = useState("08:00");

  const toggle = (key: NotifKey, ch: Channel) =>
    setNotifs(prev => ({ ...prev, [key]: { ...prev[key], [ch]: !prev[key][ch] } }));

  return (
    <div className="space-y-6">
      <SectionCard title="Notification preferences" description="Choose how you want to be notified.">
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground">
            <div>Type</div>
            <div className="text-center">Email</div>
            <div className="text-center">Push</div>
            <div className="text-center">SMS</div>
          </div>
          {NOTIF_TYPES.map((t, i) => (
            <div key={t.key} className={cn("grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-4", i !== 0 && "border-t border-border")}>
              <div>
                <div className="text-sm font-medium">{t.l}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.d}</div>
              </div>
              <div className="flex justify-center"><Switch checked={notifs[t.key].email} onCheckedChange={() => toggle(t.key, "email")} /></div>
              <div className="flex justify-center"><Switch checked={notifs[t.key].push}  onCheckedChange={() => toggle(t.key, "push")}  /></div>
              <div className="flex justify-center"><Switch checked={notifs[t.key].sms}   onCheckedChange={() => toggle(t.key, "sms")}   /></div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Quiet hours" description="Pause non-critical notifications during these times.">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Enable quiet hours</div>
            <div className="text-xs text-muted-foreground">No notifications outside the window below</div>
          </div>
          <Switch checked={quietEnabled} onCheckedChange={setQuietEnabled} />
        </div>
        <div className={cn("grid grid-cols-2 gap-4 transition-opacity", !quietEnabled && "opacity-40 pointer-events-none")}>
          <Field label="From"><Input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} /></Field>
        </div>
      </SectionCard>
    </div>
  );
}

