import {
  CreditCard,
  Mail,
  FileText,
  MapPin,
  BarChart3,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Integration } from "@/data/admin/Integration/types";


const iconMap: Record<string, React.ElementType> = {
  stripe: CreditCard,
  email: Mail,
  ats: FileText,
  "google-maps": MapPin,
  analytics: BarChart3,
  zapier: Zap,
};

interface IntegrationRowProps {
  integration: Integration;
  onConfigure: () => void;
}

export function IntegrationRow({ integration, onConfigure }: IntegrationRowProps) {
  const Icon = iconMap[integration.id] ?? FileText;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_80px] gap-2 sm:gap-4 items-center px-5 py-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={onConfigure}
    >
      {/* Name + description */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{integration.name}</p>
          <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
        </div>
      </div>

      {/* Status */}
      <div>
        <Badge variant={integration.connected ? "connected" : "disconnected"}>
          {integration.connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Last sync */}
      <span className="text-xs text-muted-foreground">{integration.lastSync}</span>

      {/* Action */}
      <div className="text-right">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
        >
          Configure
        </Button>
      </div>
    </div>
  );
}
