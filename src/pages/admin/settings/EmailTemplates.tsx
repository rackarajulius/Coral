import { useState, useMemo } from "react";
import { EmailTemplateTable } from "@/components/adminDashboard/settings/emailTemplates/EmailTemplateTable";
import { EmailTemplateEditor } from "@/components/adminDashboard/settings/emailTemplates/EmailTemplateEditor";
import { EmailTemplate, mockTemplates } from "@/data/admin/emailTemplates/emailTemplates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(mockTemplates);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const handleSelect = (template: EmailTemplate) => {
    setSelectedTemplate({ ...template });
    setEditorOpen(true);
  };

  const handleCreateNew = () => {
    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      name: "Untitled Template",
      category: "notification",
      language: "EN",
      lastUpdated: new Date().toISOString().split("T")[0],
      status: "draft",
      subject: { EN: "", FR: "" },
      body: { EN: "<p>Write your email content here...</p>", FR: "<p>Rédigez votre contenu ici...</p>" },
      senderName: "JobBoard.io",
      replyTo: "noreply@jobboard.io",
    };
    setSelectedTemplate(newTemplate);
    setEditorOpen(true);
  };

  const handleDuplicate = (template: EmailTemplate) => {
    const duplicate: EmailTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Copy)`,
      status: "draft",
      lastUpdated: new Date().toISOString().split("T")[0],
      subject: { ...template.subject },
      body: { ...template.body },
    };
    setTemplates((prev) => [...prev, duplicate]);
    toast({ title: "Template duplicated", description: `"${duplicate.name}" has been created.` });
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    const name = templates.find((t) => t.id === deleteId)?.name;
    setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
    setDeleteId(null);
    toast({ title: "Template deleted", description: `"${name}" has been removed.` });
  };

  const handleSave = (updated: EmailTemplate) => {
    setTemplates((prev) => {
      const exists = prev.find((t) => t.id === updated.id);
      if (exists) return prev.map((t) => (t.id === updated.id ? { ...updated, lastUpdated: new Date().toISOString().split("T")[0] } : t));
      return [...prev, { ...updated, lastUpdated: new Date().toISOString().split("T")[0] }];
    });
    setEditorOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <>
      <div className="space-y-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Email Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage system emails and notifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64  border-border"
              />
            </div>
            <Button size="sm" variant="default" onClick={handleCreateNew} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        <EmailTemplateTable
          templates={filtered}
          onSelect={handleSelect}
          onDuplicate={handleDuplicate}
          onDelete={(id) => setDeleteId(id)}
        />
      </div>

      <EmailTemplateEditor
        template={selectedTemplate}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
