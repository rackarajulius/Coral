import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AdminControls } from  "@/data/admin/employer/add-employer";
import type { EmployerFormData } from  "@/data/admin/employer/add-employer";
import { CompanyPreviewCard } from "./EmployerFormSections";

interface AdminControlPanelProps {
  controls: AdminControls;
  onControlChange: (updates: Partial<AdminControls>) => void;
  formData: EmployerFormData;
}

function ControlToggle({
  label,
  description,
  checked,
  onChange,
  variant,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  variant?: "default" | "destructive";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label className={`text-sm ${variant === "destructive" ? "text-destructive" : ""}`}>
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AdminControlPanel({ controls, onControlChange, formData }: AdminControlPanelProps) {
  return (
    <div className="space-y-6">
      {/* Account Controls */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Controls</p>
        <div className="space-y-3">
          <ControlToggle
            label="Verified Employer"
            checked={controls.markedVerified}
            onChange={(v) => onControlChange({ markedVerified: v })}
          />
          <ControlToggle
            label="Premium Employer"
            checked={controls.markedPremium}
            onChange={(v) => onControlChange({ markedPremium: v })}
          />
          <ControlToggle
            label="Flag account (fraud risk)"
            checked={controls.flaggedFraud}
            onChange={(v) => onControlChange({ flaggedFraud: v })}
            variant="destructive"
          />
          <ControlToggle
            label="Restrict posting"
            checked={controls.restrictPosting}
            onChange={(v) => onControlChange({ restrictPosting: v })}
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notifications</p>
        <div className="space-y-3">
          <ControlToggle
            label="Send welcome email"
            checked={controls.sendWelcomeEmail}
            onChange={(v) => onControlChange({ sendWelcomeEmail: v })}
          />
          <ControlToggle
            label="Send onboarding guide"
            checked={controls.sendOnboardingGuide}
            onChange={(v) => onControlChange({ sendOnboardingGuide: v })}
          />
          <ControlToggle
            label="Send password setup link"
            checked={controls.sendPasswordSetupLink}
            onChange={(v) => onControlChange({ sendPasswordSetupLink: v })}
          />
        </div>
      </div>

      {/* Security Controls */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Security</p>
        <div className="space-y-3">
          <ControlToggle
            label="Force password reset"
            description="Require reset on first login"
            checked={controls.forcePasswordReset}
            onChange={(v) => onControlChange({ forcePasswordReset: v })}
          />
          <ControlToggle
            label="Restrict login"
            checked={controls.restrictLogin}
            onChange={(v) => onControlChange({ restrictLogin: v })}
          />
          <ControlToggle
            label="Add internal alert"
            checked={controls.addInternalAlert}
            onChange={(v) => onControlChange({ addInternalAlert: v })}
          />
        </div>
      </div>

      <Separator />

      {/* Preview Card */}
      <CompanyPreviewCard data={formData} />
    </div>
  );
}
