import { useRef, useState } from "react";
import { SocialSharingSettings } from "@/data/admin/seo-branding/seoBranding";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X, Image, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  settings: SocialSharingSettings;
  onChange: (settings: SocialSharingSettings) => void;
}

function SocialPreview({ settings, previewUrl }: { settings: SocialSharingSettings; previewUrl?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-sm">
      <div className={cn(
        "flex items-center justify-center h-40 bg-secondary overflow-hidden",
      )}>
        {previewUrl ? (
          <img src={previewUrl} alt="Social preview" className="h-full w-full object-cover" />
        ) : settings.socialImage ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Image className="h-6 w-6" />
            <span className="text-sm">{settings.socialImage}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Image className="h-8 w-8" />
            <span className="text-xs">No image set</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium text-foreground truncate">
          {settings.shareTitle || "Share Title"}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {settings.shareDescription || "Share description will appear here..."}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
          <ExternalLink className="h-3 w-3" />
          globaljobs.io
        </div>
      </div>
    </div>
  );
}

export function SocialSharingSection({ settings, onChange }: Props) {
  const update = (partial: Partial<SocialSharingSettings>) => onChange({ ...settings, ...partial });
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    update({ socialImage: file.name });
    e.target.value = "";
  };

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    update({ socialImage: null });
  };

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-2">
        <h2 className="text-lg font-semibold text-foreground font-display">Social Sharing</h2>
        <p className="text-sm text-muted-foreground">Configure how links appear when shared on social platforms</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Default Share Title</Label>
            <Input
              value={settings.shareTitle}
              onChange={(e) => update({ shareTitle: e.target.value })}
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Default Share Description</Label>
            <Textarea
              value={settings.shareDescription}
              onChange={(e) => update({ shareDescription: e.target.value })}
              rows={3}
              className="bg-card border-border resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Social Image</Label>
            {settings.socialImage ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-10 w-10 rounded-md object-cover bg-secondary" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 text-sm truncate">{settings.socialImage}</span>
                <button
                  onClick={handleRemove}
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
            <p className="text-xs text-muted-foreground">Recommended: 1200×630px</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Link Preview</p>
          <SocialPreview settings={settings} previewUrl={previewUrl} />
        </div>
      </div>
    </section>
  );
}
