import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle } from "lucide-react";
import type { NotificationChannel, ChannelType, ChannelStatus } from "@/data/admin/alerts/types";

interface ChannelPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: NotificationChannel | null;
  onSave: (channel: NotificationChannel) => void;
}

export function ChannelPanel({ open, onOpenChange, channel, onSave }: ChannelPanelProps) {
  const isEdit = !!channel;

  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [emails, setEmails] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setType(channel.type);
      setWebhookUrl(channel.config.webhookUrl || "");
      setSlackChannel(channel.config.slackChannel || "");
      setEmails(channel.config.emails || "");
      setEndpointUrl(channel.config.endpointUrl || "");
      setHeaders(channel.config.headers || "");
    } else {
      setName("");
      setType("slack");
      setWebhookUrl("");
      setSlackChannel("");
      setEmails("");
      setEndpointUrl("");
      setHeaders("");
    }
  }, [channel, open]);

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success("Test alert sent successfully");
    }, 1500);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }
    const config: Record<string, string> = {};
    if (type === "slack") {
      config.webhookUrl = webhookUrl;
      config.slackChannel = slackChannel;
    } else if (type === "email") {
      config.emails = emails;
    } else {
      config.endpointUrl = endpointUrl;
      config.headers = headers;
    }
    const saved: NotificationChannel = {
      id: channel?.id || crypto.randomUUID(),
      name: name.trim(),
      type,
      status: "connected",
      lastUsed: channel?.lastUsed || null,
      config,
    };
    onSave(saved);
    onOpenChange(false);
    toast.success(isEdit ? "Channel updated" : "Channel added");
  };

  const statusBadge = (s: ChannelStatus) => {
    if (s === "connected") return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
    if (s === "error") return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Disconnected</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Channel" : "Add Channel"}</SheetTitle>
          <SheetDescription>Configure a notification delivery channel.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., #ops-alerts" />
            </div>
            {!isEdit && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ChannelType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isEdit && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                <span className="text-sm font-medium capitalize">{type}</span>
                <span className="mx-2">·</span>
                {statusBadge(channel!.status)}
              </div>
            )}
          </div>

          <Separator />

          {type === "slack" && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Slack Configuration</h4>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Channel Name</Label>
                <Input value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} placeholder="#ops-alerts" />
              </div>
            </div>
          )}

          {type === "email" && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Email Configuration</h4>
              <div className="space-y-2">
                <Label>Email Addresses</Label>
                <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="admin@company.com, ops@company.com" />
                <p className="text-xs text-muted-foreground">Comma-separated email addresses.</p>
              </div>
            </div>
          )}

          {type === "webhook" && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Webhook Configuration</h4>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://api.example.com/webhooks/alerts" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Headers (JSON)</Label>
                <Input value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder='{"Authorization": "Bearer ..."}' className="font-mono text-xs" />
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Method: <span className="font-medium text-foreground">POST</span></p>
                <p className="text-xs text-muted-foreground mt-1">Payload will include rule name, severity, timestamp, and message.</p>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {testing ? "Sending…" : "Send Test Alert"}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">{isEdit ? "Save Changes" : "Add Channel"}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
