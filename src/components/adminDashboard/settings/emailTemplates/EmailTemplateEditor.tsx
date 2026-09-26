import { useState, useEffect, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Eye, SendHorizonal, Save, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  EmailTemplate, EmailLanguage, EmailCategory, EmailTemplateStatus,
  PLACEHOLDER_TOKENS,
} from "@/data/admin/emailTemplates/emailTemplates";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { RichTextEditor } from "@/components/adminDashboard/settings/emailTemplates/RichTextEditor";

interface Props {
  template: EmailTemplate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (t: EmailTemplate) => void;
}

export function EmailTemplateEditor({ template, open, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [lang, setLang] = useState<EmailLanguage>("EN");
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (template) {
      setDraft({ ...template });
      setLang(template.language);
      setDirty(false);
    }
  }, [template]);

  const update = useCallback(
    <K extends keyof EmailTemplate>(key: K, value: EmailTemplate[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
      setDirty(true);
    },
    []
  );

  const updateLangField = useCallback(
    (field: "subject" | "body", value: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: { ...prev[field], [lang]: value } };
      });
      setDirty(true);
    },
    [lang]
  );

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && dirty) {
      if (!confirm("You have unsaved changes. Discard?")) return;
    }
    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    toast({ title: "Template saved", description: `"${draft.name}" has been updated.` });
    setDirty(false);
  };

  const handleSendTest = () => {
    toast({ title: "Test email sent", description: "A test email has been sent to your admin address." });
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Copied", description: `${token} copied to clipboard.` });
  };

  if (!draft) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <div className="flex h-full flex-col">
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-bold font-display">
                  {draft.name || "New Template"}
                </SheetTitle>
                {dirty && (
                  <Badge variant="secondary" className="text-xs border-0 bg-accent/15 text-accent">
                    Unsaved
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 mt-3">
                {(["EN", "FR"] as EmailLanguage[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      lang === l
                        ? "bg-orange-500 text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] divide-x divide-border">
                {/* Main editor */}
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Template Name
                    </Label>
                    <Input
                      value={draft.name}
                      onChange={(e) => update("name", e.target.value)}
                      className=" border border-border"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Category
                      </Label>
                      <Select
                        value={draft.category}
                        onValueChange={(v) => update("category", v as EmailCategory)}
                      >
                        <SelectTrigger className=" border border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="authentication">Authentication</SelectItem>
                          <SelectItem value="notification">Notification</SelectItem>
                          <SelectItem value="transactional">Transactional</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </Label>
                      <Select
                        value={draft.status}
                        onValueChange={(v) => update("status", v as EmailTemplateStatus)}
                      >
                        <SelectTrigger className="border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Subject ({lang})
                    </Label>
                    <Input
                      value={draft.subject[lang]}
                      onChange={(e) => updateLangField("subject", e.target.value)}
                      className=" border border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Body ({lang})
                    </Label>
                    <RichTextEditor
                      content={draft.body[lang]}
                      onChange={(html) => updateLangField("body", html)}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Sender Name
                      </Label>
                      <Input
                        value={draft.senderName}
                        onChange={(e) => update("senderName", e.target.value)}
                        className="border border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Reply-to
                      </Label>
                      <Input
                        value={draft.replyTo}
                        onChange={(e) => update("replyTo", e.target.value)}
                        className="border border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Side panel — Tokens */}
                <div className="p-4 space-y-3 bg-muted/30 hidden lg:block">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Placeholder Tokens
                  </h3>
                  <div className="space-y-1.5">
                    {PLACEHOLDER_TOKENS.map((t) => (
                      <button
                        key={t.token}
                        onClick={() => copyToken(t.token)}
                        className="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary"
                      >
                        <code className="font-mono text-accent shrink-0">{t.token}</code>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center justify-between gap-3 bg-card">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button variant="outline" size="sm" onClick={handleSendTest} className="gap-1.5">
                  <SendHorizonal className="h-3.5 w-3.5" />
                  Send Test
                </Button>
              </div>
              <Button variant="default" size="sm" onClick={handleSave} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save Template
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={draft.subject[lang]}
        body={draft.body[lang]}
        senderName={draft.senderName}
      />
    </>
  );
}
