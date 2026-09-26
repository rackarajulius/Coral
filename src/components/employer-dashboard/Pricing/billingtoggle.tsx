import { Switch } from '@/components/ui/switch';
import { cn } from '@/libs/utils';
import { Badge } from 'lucide-react';
import React from 'react'

const BillingToggle = ({ yearly, onChange }: { yearly: boolean; onChange: (v: boolean) => void }) => {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className={cn("text-sm", !yearly ? "text-foreground font-medium" : "text-muted-foreground")}>
        Monthly
      </span>
      <Switch checked={yearly} onCheckedChange={onChange} aria-label="Toggle yearly billing" />
      <div className="flex items-center gap-2">
        <span className={cn("text-sm", yearly ? "text-foreground font-medium" : "text-muted-foreground")}>
          Yearly
        </span>
        <Badge className="border border-accent/20 bg-accent/10 text-accent">
          Save 20%
        </Badge>
      </div>
    </div>
  )
}

export default BillingToggle;
