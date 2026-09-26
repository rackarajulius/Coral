import { EmailTemplate } from "@/data/admin/emailTemplates/emailTemplates";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
  draft:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  inactive:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

const categoryLabels: Record<string, string> = {
  authentication: "Authentication",
  notification: "Notifications",
  transactional: "Transactional",
  marketing: "Marketing",
};

interface Props {
  templates: EmailTemplate[];
  onSelect: (t: EmailTemplate) => void;
  onDuplicate: (t: EmailTemplate) => void;
  onDelete: (id: string) => void;
}

export function EmailTemplateTable({ templates, onSelect, onDuplicate, onDelete }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Template Name</TableHead>
            <TableHead className="font-semibold">Category</TableHead>
            <TableHead className="font-semibold">Language</TableHead>
            <TableHead className="font-semibold">Last Updated</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer transition-colors hover:bg-orange-100"
              onClick={() => onSelect(t)}
            >
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs font-normal">
                  {categoryLabels[t.category] ?? t.category}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {t.language}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {t.lastUpdated}
              </TableCell>
              <TableCell>
                <Badge className={cn("text-xs capitalize border-0", statusStyles[t.status])}>
                  {t.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger  asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => onDuplicate(t)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {templates.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No templates found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
