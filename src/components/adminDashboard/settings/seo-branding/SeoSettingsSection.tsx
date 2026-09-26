import { SeoSettings } from "@/data/admin/seo-branding/seoBranding";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  settings: SeoSettings;
  onChange: (settings: SeoSettings) => void;
}

function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const isShort = len > 0 && len < min;
  const isLong = len > max;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={cn(
        "text-xs",
        isShort || isLong ? "text-destructive" : "text-muted-foreground"
      )}>
        {len} / {max}
      </span>
      {isShort && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Too short
        </span>
      )}
      {isLong && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Too long
        </span>
      )}
    </div>
  );
}

function SeoPreview({ settings }: { settings: SeoSettings }) {
  const title = settings.siteTitle.EN || "Page Title";
  const url = settings.canonicalUrl || "https://example.com";
  const desc = settings.metaDescription.EN || "Page description will appear here...";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Google Search Preview</p>
      <p className="text-base text-primary font-medium leading-snug truncate" style={{ maxWidth: 600 }}>
        {title.length > 60 ? title.slice(0, 60) + "..." : title}
      </p>
      <p className="text-xs text-muted-foreground truncate">{url}</p>
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {desc.length > 160 ? desc.slice(0, 160) + "..." : desc}
      </p>
    </div>
  );
}

export function SeoSettingsSection({ settings, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (partial: Partial<SeoSettings>) => onChange({ ...settings, ...partial });

  return (
    <section className="space-y-6">
      <div className=" pb-2">
        <h2 className="text-lg font-semibold text-foreground font-display">SEO Settings</h2>
        <p className="text-sm text-muted-foreground">Control how the platform appears in search engines</p>
      </div>

      {/* Site Title */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Site Title (EN)</Label>
          <Input
            value={settings.siteTitle.EN}
            onChange={(e) => update({ siteTitle: { ...settings.siteTitle, EN: e.target.value } })}
            className="bg-card border-border"
          />
          <CharCount value={settings.siteTitle.EN} min={30} max={60} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Site Title (FR)</Label>
          <Input
            value={settings.siteTitle.FR}
            onChange={(e) => update({ siteTitle: { ...settings.siteTitle, FR: e.target.value } })}
            className="bg-card border-border"
          />
          <CharCount value={settings.siteTitle.FR} min={30} max={60} />
        </div>
      </div>

      {/* Meta Description */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Meta Description (EN)</Label>
          <Textarea
            value={settings.metaDescription.EN}
            onChange={(e) => update({ metaDescription: { ...settings.metaDescription, EN: e.target.value } })}
            rows={3}
            className="bg-card border-border resize-none"
          />
          <CharCount value={settings.metaDescription.EN} min={120} max={160} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Meta Description (FR)</Label>
          <Textarea
            value={settings.metaDescription.FR}
            onChange={(e) => update({ metaDescription: { ...settings.metaDescription, FR: e.target.value } })}
            rows={3}
            className="bg-card border-border resize-none"
          />
          <CharCount value={settings.metaDescription.FR} min={120} max={160} />
        </div>
      </div>

      {/* Canonical URL */}
      <div className="space-y-1.5 max-w-md">
        <Label className="text-sm font-medium">Canonical URL</Label>
        <Input
          value={settings.canonicalUrl}
          onChange={(e) => update({ canonicalUrl: e.target.value })}
          className="bg-card border-border"
        />
      </div>

      {/* Indexing Toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={settings.allowIndexing}
          onCheckedChange={(checked) => update({ allowIndexing: checked })}
        />
        <Label className="text-sm font-medium">Allow search engine indexing</Label>
      </div>

      {/* SEO Preview */}
      <SeoPreview settings={settings} />

      {/* Advanced */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
          Advanced SEO Settings
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Open Graph Title</Label>
              <Input
                value={settings.ogTitle}
                onChange={(e) => update({ ogTitle: e.target.value })}
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Twitter Card Type</Label>
              <Select
                value={settings.twitterCardType}
                onValueChange={(val) => update({ twitterCardType: val as SeoSettings["twitterCardType"] })}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="summary_large_image">Summary with Large Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Open Graph Description</Label>
            <Textarea
              value={settings.ogDescription}
              onChange={(e) => update({ ogDescription: e.target.value })}
              rows={2}
              className="bg-card border-border resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
