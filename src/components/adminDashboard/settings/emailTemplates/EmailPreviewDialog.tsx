import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const MOCK_DATA: Record<string, string> = {
  "{{job_title}}": "Senior Frontend Developer",
  "{{employer_name}}": "Acme Corp",
  "{{candidate_name}}": "Jane Doe",
  "{{salary_range}}": "$90,000 – $120,000",
  "{{application_date}}": "March 20, 2025",
  "{{dashboard_url}}": "https://jobboard.io/dashboard",
  "{{company_logo}}": "https://placehold.co/120x40",
};

function replacePlaceholders(text: string) {
  let result = text;
  for (const [token, value] of Object.entries(MOCK_DATA)) {
    result = result.split(token).join(value);
  }
  return result;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: string;
  body: string;
  senderName: string;
}

export function EmailPreviewDialog({ open, onOpenChange, subject, body, senderName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Email Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground font-medium w-16 shrink-0">From:</span>
              <span>{senderName}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground font-medium w-16 shrink-0">Subject:</span>
              <span className="font-medium">{replacePlaceholders(subject)}</span>
            </div>
          </div>
          <div
            className="rounded-lg border border-border bg-card p-6 prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: replacePlaceholders(body) }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
