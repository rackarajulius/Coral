import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "./shared";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  getTemplateTokens,
  updateTemplate,
  type EmailTemplate,
} from "@/lib/api/ats";

const CATEGORIES = [
  { value: "rejection", label: "Rejection" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  // Offered when approaching someone who hasn't applied (with General). A
  // sourced candidate has no job, so {{job_title}} takes the project's role.
  { value: "outreach", label: "Outreach" },
  { value: "general", label: "General" },
];

/**
 * Reusable messages to candidates.
 *
 * Closing the loop with everyone who applied is the most commonly skipped job
 * in hiring, because doing it by hand for two hundred people is unthinkable.
 * Templates are what make it one action — the rest of this product's
 * no-ghosting stance depends on them existing.
 */
export default function Templates() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);

  const templates = useQuery({ queryKey: ["email-templates"], queryFn: getTemplates, retry: false });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <SectionCard
      title="Candidate emails"
      description="Write once, send to one person or two hundred."
      action={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      }
    >
      {templates.isLoading && <Skeleton className="h-32 rounded-xl" />}

      {templates.isError && (
        <p className="text-sm text-destructive">{(templates.error as Error).message}</p>
      )}

      {templates.data?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Mail className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">No templates yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            A rejection template is the one worth writing first — it is what lets you answer
            everyone who applied rather than only the shortlist.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {templates.data?.map((t) => (
          <div
            key={t.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
          >
            <button
              type="button"
              onClick={() => setEditing(t)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{t.category}</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.subject}</p>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove.mutate(t.id)}
              disabled={remove.isPending}
              aria-label={`Delete ${t.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {editing && (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
          }}
        />
      )}
    </SectionCard>
  );
}

function TemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [category, setCategory] = useState(template?.category ?? "general");

  // Served by the API rather than listed here, so the placeholders offered can
  // never drift from the ones the server actually substitutes.
  const tokens = useQuery({ queryKey: ["template-tokens"], queryFn: getTemplateTokens });

  const save = useMutation({
    mutationFn: () =>
      template
        ? updateTemplate(template.id, { name, subject, body, category })
        : createTemplate({ name, subject, body, category }),
    onSuccess: () => {
      toast.success(template ? "Template updated" : "Template created");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const insert = (token: string) => setBody((b) => `${b}{{${token}}}`);
  const valid = name.trim() && subject.trim() && body.trim();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Placeholders are filled in per candidate when you send.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="tpl-name" className="text-xs">Name</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Not moving forward" maxLength={80} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tpl-cat" className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="tpl-cat" className="mt-1 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tpl-subject" className="text-xs">Subject</Label>
            <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="About your application to {{company_name}}" maxLength={200} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="tpl-body" className="text-xs">Message</Label>
            <Textarea id="tpl-body" value={body} onChange={(e) => setBody(e.target.value)}
              rows={9} maxLength={20000} className="mt-1 resize-y font-mono text-sm" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {tokens.data?.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insert(t)}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-solid hover:text-foreground"
                >
                  {`{{${t}}}`}
                </button>
              ))}
            </div>
            {/* An unrecognised placeholder is left visible rather than blanked,
                so a typo is caught here and not by the recipient. */}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Anything else in double braces is sent as written.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {template ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
