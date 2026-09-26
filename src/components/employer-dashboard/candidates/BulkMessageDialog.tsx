import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getTemplates, sendBulk, type EmailTemplate } from "@/lib/api/ats";

/**
 * Sends one template to everyone selected.
 *
 * This is the action that makes answering all 200 applicants possible rather
 * than theoretical. It is also the most dangerous button on the board — it
 * writes to real people and cannot be recalled — so it names the count, shows
 * the message, and asks once.
 */
export function BulkMessageDialog({
  open,
  onClose,
  applicationIds,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  applicationIds: string[];
  onSent: () => void;
}) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [markRejected, setMarkRejected] = useState(false);

  const templates = useQuery({
    queryKey: ["email-templates"],
    queryFn: getTemplates,
    retry: false,
    enabled: open,
  });

  const selected = templates.data?.find((t) => t.id === templateId) ?? null;

  const send = useMutation({
    mutationFn: () => sendBulk(templateId!, applicationIds, markRejected),
    onSuccess: (result) => {
      // `sent` is reported, not `requested`. If an id did not belong to this
      // company the server dropped it, and claiming it was sent would hide
      // that from the only person who could notice.
      if (result.sent < result.requested) {
        toast.warning(`Sent to ${result.sent} of ${result.requested}`, {
          description: "Some selections could not be matched to your jobs.",
        });
      } else {
        toast.success(`Sent to ${result.sent} candidate${result.sent === 1 ? "" : "s"}`);
      }
      setTemplateId(null);
      setMarkRejected(false);
      onSent();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            Message {applicationIds.length} candidate{applicationIds.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Each person gets their own copy with their name and role filled in. Nobody sees the
            others.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {templates.isLoading && <Skeleton className="h-24 rounded-xl" />}

          {templates.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">No templates yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Write one first — it is reusable for every round after this.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/employers/settings/templates">Create a template</Link>
              </Button>
            </div>
          )}

          {templates.data && templates.data.length > 0 && (
            <div className="space-y-1.5">
              {templates.data.map((t) => (
                <TemplateOption
                  key={t.id}
                  template={t}
                  selected={templateId === t.id}
                  onSelect={() => setTemplateId(t.id)}
                />
              ))}
            </div>
          )}

          {selected && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <p className="mt-1 text-sm font-medium">{selected.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {selected.body.slice(0, 400)}
                {selected.body.length > 400 ? "…" : ""}
              </p>
            </div>
          )}

          {selected && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border p-3">
              <Checkbox
                id="bulk-reject"
                checked={markRejected}
                onCheckedChange={(v) => setMarkRejected(v === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="bulk-reject" className="text-sm font-medium">
                  Also mark them as rejected
                </Label>
                {/* Deliberately not inferred from the template's category: a
                    rejection template may well go to someone being kept warm. */}
                <p className="text-xs text-muted-foreground">
                  Moves each application to rejected. Sending the message alone changes nothing.
                </p>
              </div>
            </div>
          )}

          {markRejected && (
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              This closes {applicationIds.length} application
              {applicationIds.length === 1 ? "" : "s"} and cannot be undone here.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={!templateId || send.isPending}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateOption({
  template,
  selected,
  onSelect,
}: {
  template: EmailTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{template.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {template.category}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</p>
    </button>
  );
}

export default BulkMessageDialog;
