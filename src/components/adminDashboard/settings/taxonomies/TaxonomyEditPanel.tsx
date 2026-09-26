import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { TaxonomyItem } from "@/data/admin/Taxonomy/taxonomies";

interface TaxonomyEditPanelProps {
  item: TaxonomyItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (item: TaxonomyItem) => void;
}

export function TaxonomyEditPanel({ item, open, onClose, onSave }: TaxonomyEditPanelProps) {
  const [form, setForm] = useState<TaxonomyItem | null>(null);

  useEffect(() => {
    if (item) setForm({ ...item });
  }, [item]);

  if (!form) return null;

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-6 space-y-6">
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-lg font-semibold text-foreground">Edit Taxonomy Item</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Update details for "{form.name}"
            </SheetDescription>
          </SheetHeader>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tax-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</Label>
              <Input
                id="tax-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="bg-secondary border-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-slug" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug</Label>
              <Input
                id="tax-slug"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                className="bg-secondary border-none font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-desc" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
              <Textarea
                id="tax-desc"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="bg-secondary border-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-parent" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent (optional)</Label>
              <Input
                id="tax-parent"
                value={form.parent || ""}
                onChange={e => setForm({ ...form, parent: e.target.value || undefined })}
                placeholder="None"
                className="bg-secondary border-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-order" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order</Label>
              <Input
                id="tax-order"
                type="number"
                value={form.order}
                onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                className="bg-secondary border-none w-24"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Status</p>
                <p className="text-xs text-muted-foreground">Enable or disable this taxonomy item</p>
              </div>
              <Switch
                checked={form.status === "active"}
                onCheckedChange={v => setForm({ ...form, status: v ? "active" : "inactive" })}
                aria-label="Toggle status"
              />
            </div>
          </div>

          <Separator />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
