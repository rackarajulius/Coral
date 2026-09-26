import { useRef, useState } from "react";
import { BrandingSettings, systemFonts } from "@/data/admin/seo-branding/seoBranding";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  settings: BrandingSettings;
  onChange: (settings: BrandingSettings) => void;
}

function FileUploadZone({
  label,
  value,
  previewUrl,
  onFile,
  onRemove,
  accept = "image/png,image/svg+xml",
}: {
  label: string;
  value: string | null;
  previewUrl?: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    onFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-10 w-10 rounded-md object-contain bg-secondary" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="flex-1 text-sm text-foreground truncate">{value}</span>
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border",
            "bg-card py-6 text-sm text-muted-foreground transition-colors",
            "hover:border-muted-foreground/40 hover:text-foreground"
          )}
        >
          <Upload className="h-4 w-4" />
          Drop file or click to upload
        </button>
      )}
      <p className="text-xs text-muted-foreground">PNG, SVG — max 2MB</p>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-card border-border w-32 font-mono text-sm"
          maxLength={7}
        />
        <div
          className="h-8 w-8 rounded-md border border-border"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}

export function BrandingSection({ settings, onChange }: Props) {
  const update = (partial: Partial<BrandingSettings>) => onChange({ ...settings, ...partial });
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const handleFile = (field: "logo" | "favicon" | "darkModeLogo", file: File) => {
    const url = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [field]: url }));
    update({ [field]: file.name } as Partial<BrandingSettings>);
  };

  const handleRemove = (field: "logo" | "favicon" | "darkModeLogo") => {
    if (previews[field]) URL.revokeObjectURL(previews[field]);
    setPreviews((p) => { const n = { ...p }; delete n[field]; return n; });
    update({ [field]: null } as Partial<BrandingSettings>);
  };

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-2">
        <h2 className="text-lg font-semibold text-foreground font-display">Branding</h2>
        <p className="text-sm text-muted-foreground">Manage logo, colors, and typography</p>
      </div>

      {/* Logo uploads */}
      <div className="grid gap-4 md:grid-cols-3">
        <FileUploadZone
          label="Logo (Primary)"
          value={settings.logo}
          previewUrl={previews.logo}
          onFile={(f) => handleFile("logo", f)}
          onRemove={() => handleRemove("logo")}
        />
        <FileUploadZone
          label="Favicon"
          value={settings.favicon}
          previewUrl={previews.favicon}
          onFile={(f) => handleFile("favicon", f)}
          onRemove={() => handleRemove("favicon")}
        />
        <FileUploadZone
          label="Dark Mode Logo"
          value={settings.darkModeLogo}
          previewUrl={previews.darkModeLogo}
          onFile={(f) => handleFile("darkModeLogo", f)}
          onRemove={() => handleRemove("darkModeLogo")}
        />
      </div>

      {/* Colors */}
      <div className="grid gap-6 md:grid-cols-2">
        <ColorPicker
          label="Primary Color"
          value={settings.primaryColor}
          onChange={(v) => update({ primaryColor: v })}
        />
        <ColorPicker
          label="Secondary Color"
          value={settings.secondaryColor}
          onChange={(v) => update({ secondaryColor: v })}
        />
      </div>

      {/* Typography */}
      <div className="space-y-1.5 max-w-xs">
        <Label className="text-sm font-medium">Font Family</Label>
        <Select value={settings.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {systemFonts.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
