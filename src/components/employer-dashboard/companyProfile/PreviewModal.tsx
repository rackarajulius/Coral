import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { PublicProfilePreview } from "@/components/employer-dashboard/companyProfile/PublicProfilePreview";
import { Eye } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: EmployerBrand;
}

export function PreviewModal({ open, onOpenChange, data }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden h-[90vh] flex flex-col gap-0">
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-gradient-to-r from-primary to-navy-light text-primary-foreground shrink-0">
          <Eye className="w-4 h-4 text-accent" />
          <p className="text-sm font-medium">Preview — this is how candidates will see your profile</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PublicProfilePreview data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}