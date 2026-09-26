import { Banner } from "@/data/admin/seo-branding/seoBranding";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  banners: Banner[];
  onSelect: (banner: Banner) => void;
  onCreateNew: () => void;
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  scheduled: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  expired: "bg-muted text-muted-foreground border-border",
  draft: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

const typeStyles: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  promotion: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

export function BannersSection({ banners, onSelect, onCreateNew }: Props) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground font-display">Banners & Announcements</h2>
          <p className="text-sm text-muted-foreground">Manage site-wide banners and notifications</p>
        </div>
        <Button onClick={onCreateNew} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Banner
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Message</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-28">Start Date</TableHead>
              <TableHead className="w-28">End Date</TableHead>
              <TableHead className="w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((banner) => (
              <TableRow
                key={banner.id}
                onClick={() => onSelect(banner)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium text-foreground max-w-xs truncate">
                  {banner.message}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize text-xs", typeStyles[banner.type])}>
                    {banner.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{banner.startDate}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{banner.endDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize text-xs", statusStyles[banner.status])}>
                    {banner.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {banners.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No banners created yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
