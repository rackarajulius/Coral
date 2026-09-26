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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Copy, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Integration } from "@/data/admin/Integration/types";

interface IntegrationConfigPanelProps {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updated: Integration) => void;
}

export function IntegrationConfigPanel({
  integration,
  open,
  onOpenChange,
  onUpdate,
}: IntegrationConfigPanelProps) {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (integration) {
      setApiKey(integration.apiKey);
      setTestMode(integration.testMode);
      setShowKey(false);
    }
  }, [integration]);

  if (!integration) return null;

  const handleConnect = () => {
    onUpdate({ ...integration, connected: !integration.connected });
    toast({
      title: integration.connected ? "Disconnected" : "Connected",
      description: `${integration.name} has been ${integration.connected ? "disconnected" : "connected"}.`,
    });
  };

  const handleSave = () => {
    onUpdate({ ...integration, apiKey, testMode });
    toast({ title: "Saved", description: `${integration.name} configuration updated.` });
    onOpenChange(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard." });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg">{integration.name}</SheetTitle>
            <Badge variant={integration.connected ? "connected" : "disconnected"} className="text-[10px]">
              {integration.connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <SheetDescription>{integration.description}</SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="space-y-6 py-6">
          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key…"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Webhook URL */}
          {integration.webhookUrl && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={integration.webhookUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(integration.webhookUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Webhook Status */}
          {integration.webhookUrl && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {integration.webhookActive ? (
                  <CheckCircle2 className="h-4 w-4 text-status-connected" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Webhook</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {integration.webhookActive ? "Active" : "Inactive"}
              </span>
            </div>
          )}

          <Separator />

          {/* Test Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Test Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use sandbox credentials for testing
              </p>
            </div>
            <Switch checked={testMode} onCheckedChange={setTestMode} />
          </div>

          <Separator />

          {/* Connect / Disconnect */}
          <Button
            variant={integration.connected ? "outline" : "default"}
            className="w-full"
            onClick={handleConnect}
          >
            {integration.connected ? "Disconnect" : "Connect"}
          </Button>

          {/* Save */}
          <Button className="w-full" onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
