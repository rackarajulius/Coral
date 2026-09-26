import { IntegrationConfigPanel } from "@/components/adminDashboard/settings/integrations/IntegrationConfigPanel";
import { IntegrationRow } from "@/components/adminDashboard/settings/integrations/IntegrationRow";
import { Integration } from "@/data/admin/Integration/types";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";


const initialIntegrations: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing for subscriptions and one-time charges",
    category: "Payments",
    connected: true,
    lastSync: "2 min ago",
    apiKey: "sk_live_•••••••••••••4242",
    webhookUrl: "https://jobboard.io/api/webhooks/stripe",
    webhookActive: true,
    testMode: false,
  },
  {
    id: "email",
    name: "Email Provider",
    description: "Transactional and marketing email delivery",
    category: "Communication",
    connected: true,
    lastSync: "15 min ago",
    apiKey: "re_•••••••••••••abc1",
    webhookUrl: "https://jobboard.io/api/webhooks/email",
    webhookActive: true,
    testMode: false,
  },
  {
    id: "ats",
    name: "ATS Exports",
    description: "Applicant tracking system data synchronization",
    category: "HR",
    connected: false,
    lastSync: "Never",
    apiKey: "",
    webhookUrl: "",
    webhookActive: false,
    testMode: true,
  },
  {
    id: "google-maps",
    name: "Google Maps",
    description: "Location services and geocoding for job listings",
    category: "Location",
    connected: true,
    lastSync: "1 hr ago",
    apiKey: "AIza•••••••••••••Xy9",
    webhookUrl: "",
    webhookActive: false,
    testMode: false,
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Website traffic and conversion tracking",
    category: "Analytics",
    connected: true,
    lastSync: "5 min ago",
    apiKey: "UA-•••••••-1",
    webhookUrl: "",
    webhookActive: false,
    testMode: false,
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Workflow automation and third-party app connections",
    category: "Automation",
    connected: false,
    lastSync: "Never",
    apiKey: "",
    webhookUrl: "",
    webhookActive: false,
    testMode: true,
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = integrations.find((i) => i.id === selectedId) ?? null;

  const handleUpdate = (updated: Integration) => {
    setIntegrations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  return (
    <div>
      <div className="space-y-6 p-6 md:p-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Manage external services and API connections
          </p>
        </div>

         <Separator className="mb-6" />

        {/* Canada-Specific Tax Config */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Canada Tax Configuration
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">GST/HST Number</label>
              <input
                type="text"
                placeholder="123456789RT0001"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">CRA Business Number</label>
              <input
                type="text"
                placeholder="123456789"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Integration List */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-3 border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Integration</span>
            <span>Status</span>
            <span>Last Sync</span>
            <span className="text-right">Action</span>
          </div>

          {integrations.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              onConfigure={() => setSelectedId(integration.id)}
            />
          ))}
        </div>
      </div>

      {/* Configuration Slide-over */}
      <IntegrationConfigPanel
        integration={selected}
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
