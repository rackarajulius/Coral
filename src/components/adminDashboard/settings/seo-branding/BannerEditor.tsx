import { Banner } from "@/data/admin/seo-branding/seoBranding";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  banner: Banner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (banner: Banner) => void;
  onDelete: (id: string) => void;
}

export function BannerEditor({ banner, open, onOpenChange, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Banner | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (banner) {
      setForm({ ...banner });
      setDirty(false);
    }
  }, [banner]);

  const update = useCallback((partial: Partial<Banner>) => {
    setForm((prev) => prev ? { ...prev, ...partial } : prev);
    setDirty(true);
  }, []);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && dirty) {
      setShowConfirm(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  if (!form) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              {banner?.id ? "Edit Banner" : "New Banner"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => update({ message: e.target.value })}
                rows={3}
                className="bg-card border-border resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Banner Type</Label>
                <Select value={form.type} onValueChange={(v) => update({ type: v as Banner["type"] })}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Target Pages</Label>
                <Input
                  value={form.targetPages.join(", ")}
                  onChange={(e) => update({ targetPages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="all, homepage, jobs"
                  className="bg-card border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update({ startDate: e.target.value })}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update({ endDate: e.target.value })}
                  className="bg-card border-border"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => update({ enabled: checked })}
              />
              <Label className="text-sm font-medium">Enable banner</Label>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button onClick={() => onSave(form)} disabled={!dirty} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Save Banner
              </Button>
              {banner?.id && (
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(form.id)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Discard them?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); setDirty(false); onOpenChange(false); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
