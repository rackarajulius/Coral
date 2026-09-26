import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Info, RotateCcw, Save } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface SettingsState {
  platformName: string;
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  publicSignups: boolean;
  privacyPolicyUrl: string;
  termsUrl: string;
  accessibilityUrl: string;
}

const defaults: SettingsState = {
  platformName: "Global Job Board",
  defaultLanguage: "en",
  defaultCurrency: "CAD",
  timezone: "America/Toronto",
  publicSignups: true,
  privacyPolicyUrl: "https://jobboard.io/privacy",
  termsUrl: "https://jobboard.io/terms",
  accessibilityUrl: "",
};

const timezones = [
  { value: "America/St_Johns", label: "(GMT-03:30) Newfoundland" },
  { value: "America/Halifax", label: "(GMT-04:00) Atlantic Time" },
  { value: "America/Toronto", label: "(GMT-05:00) Eastern Time" },
  { value: "America/Winnipeg", label: "(GMT-06:00) Central Time" },
  { value: "America/Edmonton", label: "(GMT-07:00) Mountain Time" },
  { value: "America/Vancouver", label: "(GMT-08:00) Pacific Time" },
  { value: "UTC", label: "(GMT+00:00) UTC" },
];

const currencies = [
  { value: "CAD", label: "CAD ($)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({ ...defaults });
  const [saved, setSaved] = useState<SettingsState>({ ...defaults });
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved],
  );

  const urlErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (touched.has("privacyPolicyUrl") && !isValidUrl(settings.privacyPolicyUrl))
      errs.privacyPolicyUrl = "Please enter a valid secure URL (https://)";
    if (touched.has("termsUrl") && !isValidUrl(settings.termsUrl))
      errs.termsUrl = "Please enter a valid secure URL (https://)";
    if (touched.has("accessibilityUrl") && !isValidUrl(settings.accessibilityUrl))
      errs.accessibilityUrl = "Please enter a valid secure URL (https://)";
    return errs;
  }, [settings, touched]);

  const hasErrors = Object.keys(urlErrors).length > 0;

  const update = useCallback(
    (field: keyof SettingsState, value: string | boolean) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaved({ ...settings });
    setTouched(new Set());
    setSaving(false);
    toast.success("Settings saved successfully");
  };

  const handleReset = () => {
    setSettings({ ...saved });
    setTouched(new Set());
    setShowReset(false);
    toast("Changes reverted");
  };

  return (
    <>
      <div className="space-y-8 p-6 md:p-8 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              General Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure global platform behavior and compliance
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={!isDirty}
              onClick={() => setShowReset(true)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={!isDirty || hasErrors || saving}
              onClick={handleSave}
            >
             <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

         <Separator className="mb-6" />

        {/* ── Section 1: Platform Configuration ── */}
        <section className="space-y-6">
          <h2 className="text-base font-medium text-foreground">
            Platform Configuration
          </h2>

          {/* Platform Name */}
          <div className="space-y-1.5">
            <Label htmlFor="platformName">Platform Name</Label>
            <Input
              id="platformName"
              value={settings.platformName}
              onChange={(e) => update("platformName", e.target.value)}
              placeholder="Global Job Board"
              className="max-w-md"
            />
          </div>

          {/* Default Language */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>Default Language</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px] text-xs">
                    This affects system-generated emails and default UI strings.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ToggleGroup
              type="single"
              value={settings.defaultLanguage}
              onValueChange={(v) => v && update("defaultLanguage", v)}
              className="justify-start"
            >
              <ToggleGroupItem value="en" className="px-4 text-sm">
                English (EN)
              </ToggleGroupItem>
              <ToggleGroupItem value="fr" className="px-4 text-sm">
                French (FR)
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Default Currency */}
          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <Select
              value={settings.defaultCurrency}
              onValueChange={(v) => update("defaultCurrency", v)}
            >
              <SelectTrigger className="max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={(v) => update("timezone", v)}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Public Signups */}
          <div className="flex items-start gap-3">
            <Switch
              id="publicSignups"
              checked={settings.publicSignups}
              onCheckedChange={(v) => update("publicSignups", v)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="publicSignups" className="cursor-pointer">
                Enable Public Signups
              </Label>
              <p className="text-xs text-muted-foreground">
                When disabled, jobseekers can only be added manually by an administrator.
              </p>
            </div>
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="border-t border-border" />

        {/* ── Section 2: Compliance & Legal ── */}
        <section className="space-y-6">
          <h2 className="text-base font-medium text-foreground">
            Compliance & Legal
          </h2>

          {/* Privacy Policy URL */}
          <UrlField
            id="privacyPolicyUrl"
            label="Privacy Policy URL"
            value={settings.privacyPolicyUrl}
            error={urlErrors.privacyPolicyUrl}
            helper="Ensure this reflects current PIPEDA requirements for data handling."
            onChange={(v) => update("privacyPolicyUrl", v)}
            onBlur={() => markTouched("privacyPolicyUrl")}
          />

          {/* Terms of Service URL */}
          <UrlField
            id="termsUrl"
            label="Terms of Service URL"
            value={settings.termsUrl}
            error={urlErrors.termsUrl}
            onChange={(v) => update("termsUrl", v)}
            onBlur={() => markTouched("termsUrl")}
          />

          {/* Accessibility Statement URL */}
          <UrlField
            id="accessibilityUrl"
            label="Accessibility Statement URL"
            value={settings.accessibilityUrl}
            error={urlErrors.accessibilityUrl}
            helper="Required for AODA/WCAG 2.1 compliance in Ontario."
            onChange={(v) => update("accessibilityUrl", v)}
            onBlur={() => markTouched("accessibilityUrl")}
          />
        </section>
      </div>

      {/* Reset Confirmation Modal */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Platform Configuration. Are you sure
              you want to revert to the last saved state?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Reusable URL Field ── */
function UrlField({
  id,
  label,
  value,
  error,
  helper,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  helper?: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-1.5 max-w-lg">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="https://"
        className={error ? "border-destructive focus-visible:ring-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {helper && !error && (
        <p className="text-xs text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}
