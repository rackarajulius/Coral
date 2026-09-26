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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type {
  AlertRule,
  AlertSeverity,
  MetricType,
  OperatorType,
  ChannelType,
  EscalationStep,
  METRIC_LABELS,
  OPERATOR_LABELS,
} from "@/data/admin/alerts/types";

const METRICS: { value: MetricType; label: string }[] = [
  { value: "api_error_rate", label: "API Error Rate" },
  { value: "api_latency", label: "API Latency" },
  { value: "job_failures", label: "Job Failures" },
  { value: "queue_size", label: "Queue Size" },
  { value: "login_failures", label: "Login Failures" },
  { value: "custom", label: "Custom Metric" },
];

const OPERATORS: { value: OperatorType; label: string }[] = [
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "equals", label: "Equals" },
];

const SEVERITIES: { value: AlertSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const TIME_WINDOWS = ["1 minute", "2 minutes", "5 minutes", "10 minutes", "15 minutes", "30 minutes"];

const CHANNELS: { value: ChannelType; label: string }[] = [
  { value: "slack", label: "Slack" },
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
];

interface AlertRulePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AlertRule | null;
  onSave: (rule: AlertRule) => void;
}

export function AlertRulePanel({ open, onOpenChange, rule, onSave }: AlertRulePanelProps) {
  const isEdit = !!rule;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<MetricType>("api_error_rate");
  const [operator, setOperator] = useState<OperatorType>("greater_than");
  const [threshold, setThreshold] = useState("5");
  const [timeWindow, setTimeWindow] = useState("2 minutes");
  const [severity, setSeverity] = useState<AlertSeverity>("medium");
  const [channels, setChannels] = useState<ChannelType[]>(["email"]);
  const [cooldown, setCooldown] = useState("10");
  const [retrigger, setRetrigger] = useState(true);
  const [autoResolve, setAutoResolve] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationSteps, setEscalationSteps] = useState<EscalationStep[]>([]);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description);
      setMetric(rule.metric);
      setOperator(rule.operator);
      setThreshold(String(rule.threshold));
      setTimeWindow(rule.timeWindow);
      setSeverity(rule.severity);
      setChannels(rule.channels);
      setCooldown(String(rule.cooldownMinutes));
      setRetrigger(rule.retrigger);
      setAutoResolve(rule.autoResolve);
      setEnabled(rule.status === "active");
      setEscalationEnabled(rule.escalationEnabled);
      setEscalationSteps(rule.escalationSteps);
    } else {
      setName("");
      setDescription("");
      setMetric("api_error_rate");
      setOperator("greater_than");
      setThreshold("5");
      setTimeWindow("2 minutes");
      setSeverity("medium");
      setChannels(["email"]);
      setCooldown("10");
      setRetrigger(true);
      setAutoResolve(true);
      setEnabled(true);
      setEscalationEnabled(false);
      setEscalationSteps([]);
    }
  }, [rule, open]);

  const toggleChannel = (ch: ChannelType) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (channels.length === 0) {
      toast.error("Select at least one notification channel");
      return;
    }
    const saved: AlertRule = {
      id: rule?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      metric,
      operator,
      threshold: Number(threshold),
      timeWindow,
      severity,
      channels,
      status: enabled ? "active" : "disabled",
      cooldownMinutes: Number(cooldown),
      retrigger,
      autoResolve,
      escalationEnabled,
      escalationSteps,
      lastTriggered: rule?.lastTriggered || null,
      createdAt: rule?.createdAt || new Date().toISOString(),
    };
    onSave(saved);
    onOpenChange(false);
    toast.success(isEdit ? "Alert rule updated" : "Alert rule created");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Alert Rule" : "Create Alert Rule"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Modify the alert rule configuration." : "Define when and how you get notified."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Basic Info</h4>
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., API Error Spike" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description (optional)</Label>
              <Textarea id="rule-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this alert rule" rows={2} />
            </div>
          </div>

          <Separator />

          {/* Condition Builder */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Condition</h4>
            <p className="text-xs text-muted-foreground">Define when this alert should trigger.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={operator} onValueChange={(v) => setOperator(v as OperatorType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-2">
                <Label>Time Window</Label>
                <Select value={timeWindow} onValueChange={setTimeWindow}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_WINDOWS.map((tw) => (
                      <SelectItem key={tw} value={tw}>{tw}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Trigger when <span className="font-medium text-foreground">{METRICS.find((m) => m.value === metric)?.label}</span>{" "}
                is <span className="font-medium text-foreground">{OPERATORS.find((o) => o.value === operator)?.label?.toLowerCase()}</span>{" "}
                <span className="font-medium text-foreground">{threshold || "…"}</span>{" "}
                for <span className="font-medium text-foreground">{timeWindow}</span>
              </p>
            </div>
          </div>

          <Separator />

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Notification Channels */}
          <div className="space-y-3">
            <Label>Notification Channels</Label>
            <div className="space-y-2">
              {CHANNELS.map((ch) => (
                <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={channels.includes(ch.value)} onCheckedChange={() => toggleChannel(ch.value)} />
                  <span className="text-sm">{ch.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Behavior */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Behavior</h4>
            <div className="space-y-2">
              <Label>Cooldown (minutes)</Label>
              <Input type="number" value={cooldown} onChange={(e) => setCooldown(e.target.value)} placeholder="10" />
              <p className="text-xs text-muted-foreground">Minimum time between repeated alerts.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Re-trigger</p>
                <p className="text-xs text-muted-foreground">Fire again if condition persists after cooldown.</p>
              </div>
              <Switch checked={retrigger} onCheckedChange={setRetrigger} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-resolve</p>
                <p className="text-xs text-muted-foreground">Automatically resolve when condition clears.</p>
              </div>
              <Switch checked={autoResolve} onCheckedChange={setAutoResolve} />
            </div>
          </div>

          <Separator />

          {/* Escalation Chain */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Escalation Chain</p>
                <p className="text-xs text-muted-foreground">Auto-escalate to additional channels if unresolved.</p>
              </div>
              <Switch checked={escalationEnabled} onCheckedChange={setEscalationEnabled} />
            </div>

            {escalationEnabled && (
              <div className="space-y-3 pl-1">
                {escalationSteps.map((step, idx) => (
                  <div key={step.id} className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Step {idx + 1}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setEscalationSteps((prev) => prev.filter((s) => s.id !== step.id))}
                      >
                        <span className="text-xs">✕</span>
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Escalate after (minutes)</Label>
                      <Input
                        type="number"
                        value={step.delayMinutes}
                        onChange={(e) =>
                          setEscalationSteps((prev) =>
                            prev.map((s) => s.id === step.id ? { ...s, delayMinutes: Number(e.target.value) } : s)
                          )
                        }
                        className="h-8 text-sm"
                        placeholder="15"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Notify via</Label>
                      <div className="flex gap-3">
                        {CHANNELS.map((ch) => (
                          <label key={ch.value} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={step.channels.includes(ch.value)}
                              onCheckedChange={() =>
                                setEscalationSteps((prev) =>
                                  prev.map((s) =>
                                    s.id === step.id
                                      ? {
                                          ...s,
                                          channels: s.channels.includes(ch.value)
                                            ? s.channels.filter((c) => c !== ch.value)
                                            : [...s.channels, ch.value],
                                        }
                                      : s
                                  )
                                )
                              }
                            />
                            <span className="text-xs">{ch.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Custom message (optional)</Label>
                      <Input
                        value={step.notifyMessage || ""}
                        onChange={(e) =>
                          setEscalationSteps((prev) =>
                            prev.map((s) => s.id === step.id ? { ...s, notifyMessage: e.target.value } : s)
                          )
                        }
                        className="h-8 text-sm"
                        placeholder="URGENT: Unresolved for 15+ min"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={() =>
                    setEscalationSteps((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), delayMinutes: 15, channels: ["slack"], notifyMessage: "" },
                    ])
                  }
                >
                  + Add Escalation Step
                </Button>

                {escalationSteps.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {escalationSteps.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && " → "}
                          <span className="font-medium text-foreground">{s.delayMinutes}m</span>
                          {" "}
                          {s.channels.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Toggle this rule on or off.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">{isEdit ? "Save Changes" : "Create Rule"}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
