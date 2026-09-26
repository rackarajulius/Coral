import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";

interface Filters {
  status: string;
  industry: string;
}

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const industries = [
  "All",
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Construction",
  "Staffing & Recruiting",
  "Food & Beverage",
  "Automotive",
  "Retail",
];

export function EmployersFilters({ filters, onFiltersChange }: Props) {
  const reset = () => onFiltersChange({ status: "all", industry: "all" });
  const hasActive = filters.status !== "all" || filters.industry !== "all";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActive && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {[filters.status, filters.industry].filter((v) => v !== "all").length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(v) => onFiltersChange({ ...filters, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={filters.industry} onValueChange={(v) => onFiltersChange({ ...filters, industry: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i} value={i === "All" ? "all" : i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={reset} variant="default" className="flex-1 rounded-full">Reset</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
